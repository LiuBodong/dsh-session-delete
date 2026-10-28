/**
 * Session Delete — Host half.
 *
 * Registers one exact Fetch route behind Connection's authenticated `/api`
 * fence. The route removes a Session's durable artifacts:
 *
 * - its persistence directory (`<sessionsRoot>/<project>/<sessionId>/`, which
 *   holds the session log, its lock, and every artifact generation);
 * - its persisted projection-cache record
 *   (`<storageRoot>/session_projcache/sessions/<sessionId>.json`);
 * - its registry markers (pin / archive) through `WorkspaceRegistry`;
 * - its row in every connected page, through the `api-session/removed` relay.
 *
 * A live Session is cancelled first and re-cleaned when it is disposed, so the
 * disposal-time checkpoint cannot resurrect the data. Attachments are stored
 * content-addressed and shared between Sessions, so they are deliberately left
 * alone.
 *
 * @module @local/dsh-session-delete
 */
import { lstat, readdir, rm, rmdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

/** Stable Loader plugin name. */
export const name = 'session-delete';

/** Connection owns the `/api` fence; persistence answers whether the id exists. */
export const inject = ['connection', 'sessionPersistence'];

/** Exact path below `/api`; the browser calls its document-relative form. */
const ROUTE = '/api/session-delete/delete';

/** One Session id as a single, safe path segment. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** The projection-cache domain and table owned by `dsh-session-projection-cache`. */
const CACHE_DOMAIN = 'session_projcache';
const CACHE_TABLE = 'sessions';

/** How long a cancelled turn may take to settle before deletion proceeds. */
const IDLE_TIMEOUT_MS = 5000;

/** Re-clean delays after a live Session was deleted under its feet. */
const RECLAIM_DELAYS_MS = [400, 2000];

function describe(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function failure(status, code, message, details) {
  return Response.json(
    { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Remove the Session's persisted log directories.
 * @param sessionsRoot - absolute sessions root.
 * @param sessionId - validated Session id.
 * @returns absolute directories that were removed.
 */
async function removeSessionLogs(sessionsRoot, sessionId) {
  const removed = [];
  let projects;
  try {
    projects = await readdir(sessionsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return removed;
    throw error;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const target = resolve(sessionsRoot, project.name, sessionId);
    if (!target.startsWith(sessionsRoot + sep)) continue;
    let info;
    try {
      info = await lstat(target);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (!info.isDirectory()) continue;
    await rm(target, { recursive: true, force: true });
    removed.push(target);
    // Drop the project bucket once its last Session is gone.
    await rmdir(resolve(sessionsRoot, project.name)).catch(() => {});
  }
  return removed;
}

/**
 * Remove the Session's persisted projection-cache records.
 * @param storageRoot - absolute storage root.
 * @param sessionId - validated Session id.
 * @returns absolute files that were removed.
 */
async function removeProjectionCache(storageRoot, sessionId) {
  const removed = [];
  const table = join(storageRoot, CACHE_DOMAIN, CACHE_TABLE);
  let names;
  try {
    names = await readdir(table);
  } catch (error) {
    if (error?.code === 'ENOENT') return removed;
    throw error;
  }
  for (const fileName of names) {
    if (fileName !== `${sessionId}.json` && !fileName.startsWith(`${sessionId}.json.`)) continue;
    const target = join(table, fileName);
    await rm(target, { force: true });
    removed.push(target);
  }
  return removed;
}

/**
 * Install the delete route and its live-Session reclamation.
 * @param ctx - owning Host plugin context.
 * @param config - `sessionsRoot` / `storageRoot`, defaulting to the harness home.
 */
export function apply(ctx, config = {}) {
  const home = typeof config.home === 'string' && config.home !== '' ? config.home : process.env.DSH_HOME || join(homedir(), '.dsh');
  const sessionsRoot = resolve(typeof config.sessionsRoot === 'string' && config.sessionsRoot !== '' ? config.sessionsRoot : join(home, 'sessions'));
  const storageRoot = resolve(typeof config.storageRoot === 'string' && config.storageRoot !== '' ? config.storageRoot : join(home, 'storages'));

  /** Session ids already deleted in this process whose disposal may still flush. */
  const reclaim = new Set();
  /** Ids with a deletion in flight. */
  const deleting = new Set();

  const sessionExists = async (sessionId) => {
    try {
      return (await ctx.sessionPersistence.stat(sessionId)) !== undefined;
    } catch {
      return true;
    }
  };

  const stopRunningTurn = async (agent) => {
    if (agent === undefined || agent.status !== 'running') return false;
    agent.cancel({ kind: 'user' });
    await Promise.race([agent.whenIdle().catch(() => {}), sleep(IDLE_TIMEOUT_MS)]);
    return true;
  };

  const erase = async (sessionId) => {
    const logs = await removeSessionLogs(sessionsRoot, sessionId);
    const cache = await removeProjectionCache(storageRoot, sessionId);
    return { logs, cache };
  };

  const settleRegistryMarkers = async (sessionId) => {
    const registry = ctx.get('workspaceRegistry');
    const settled = { unpinned: false, unarchived: false };
    if (registry === undefined) return settled;
    try {
      if (registry.pinnedSessionIds?.includes(sessionId) === true) {
        await registry.unpinSession(sessionId);
        settled.unpinned = true;
      }
    } catch (error) {
      console.warn(`[session-delete] unpin failed for ${sessionId}: ${describe(error)}`);
    }
    try {
      if (registry.archivedSessionIds?.includes(sessionId) === true) {
        await registry.unarchiveSession(sessionId);
        settled.unarchived = true;
      }
    } catch (error) {
      console.warn(`[session-delete] unarchive failed for ${sessionId}: ${describe(error)}`);
    }
    return settled;
  };

  /** Re-erase a deleted live Session after its owner disposes, and keep watching briefly. */
  const reclaimLater = (sessionId, delay) => {
    const timer = setTimeout(() => {
      void erase(sessionId).catch((error) => {
        console.warn(`[session-delete] reclamation failed for ${sessionId}: ${describe(error)}`);
      });
    }, delay);
    timer.unref?.();
  };

  const scheduleReclaim = (sessionId) => {
    reclaim.add(sessionId);
    for (const delay of RECLAIM_DELAYS_MS) reclaimLater(sessionId, delay);
  };

  const reclaimIfDeleted = (subject) => {
    const id = typeof subject === 'string' ? subject : subject?.id ?? subject?.session?.id;
    if (typeof id !== 'string' || !reclaim.has(id)) return;
    reclaimLater(id, 0);
  };

  ctx.on('session/disposed', (session) => reclaimIfDeleted(session?.id));
  ctx.on('agent/disposed', (payload) => reclaimIfDeleted(payload?.agent?.id));

  const deleteSession = async (sessionId) => {
    const agents = ctx.get('agents');
    const agent = agents?.get?.(sessionId);
    const existed = (await sessionExists(sessionId)) || agent !== undefined;
    if (!existed) throw Object.assign(new Error(`session "${sessionId}" not found`), { status: 404, code: 'session-not-found' });

    const stopped = await stopRunningTurn(agent);
    const erased = await erase(sessionId);
    const markers = await settleRegistryMarkers(sessionId);

    // Tell every connected page the row is gone, even though the Host never
    // disposed a live Session here (the relay `session/disposed` owns the rest).
    ctx.emit('api-session/removed', sessionId);
    if (agent !== undefined) scheduleReclaim(sessionId);

    return {
      sessionId,
      stoppedRunningTurn: stopped,
      removedLogDirectories: erased.logs.length,
      removedProjectionCacheFiles: erased.cache.length,
      unpinned: markers.unpinned,
      unarchived: markers.unarchived,
      live: agent !== undefined,
    };
  };

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let payload;
          try {
            payload = await request.json();
          } catch {
            return failure(400, 'invalid-body', 'the request body must be JSON');
          }
          const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : '';
          if (!SESSION_ID.test(sessionId)) {
            return failure(400, 'invalid-session-id', 'a single Session id is required');
          }
          if (deleting.has(sessionId)) {
            return failure(409, 'delete-in-progress', `session "${sessionId}" is already being deleted`);
          }
          deleting.add(sessionId);
          try {
            const value = await deleteSession(sessionId);
            return Response.json({ ok: true, value }, { headers: { 'cache-control': 'no-store' } });
          } catch (error) {
            const status = typeof error?.status === 'number' ? error.status : 500;
            const code = typeof error?.code === 'string' ? error.code : 'delete-failed';
            if (status >= 500) console.warn(`[session-delete] ${sessionId}: ${describe(error)}`);
            return failure(status, code, describe(error));
          } finally {
            deleting.delete(sessionId);
          }
        },
      }),
    'session-delete: route',
  );
}
