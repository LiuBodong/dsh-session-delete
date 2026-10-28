window.__ModuleLoader__.load({
  id: '@local/dsh-session-delete',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = '@local/dsh-session-delete';
    /** Document-relative form of the Host route, so a sub-path mount keeps working. */
    const DELETE_ROUTE = 'api/session-delete/delete';
    const STYLE_ID = '@local/dsh-session-delete';

    // ---------------------------------------------------------------- styles
    // Menu row, dialog, and buttons follow the host's own primitives; every
    // color and radius comes from the theme tokens the shell defines.
    const CSS = `
.sd-menu-item{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;cursor:pointer;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);text-align:left;font-family:inherit}
.sd-menu-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.sd-menu-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover-danger);outline:none}
.sd-menu-item-danger{color:var(--dsw-alias-state-error-primary)}
.sd-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:16px}
.sd-root{pointer-events:auto;position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px}
.sd-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.sd-dialog{box-sizing:border-box;position:relative;z-index:1;display:flex;flex-direction:column;gap:20px;width:min(420px,100%);padding:0 0 24px;overflow:hidden;border:0;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent)}
.sd-dialog:focus{outline:none}
.sd-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 12px 24px}
.sd-title{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}
.sd-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary)}
.sd-close:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.sd-close:disabled{opacity:.4;cursor:not-allowed}
.sd-description{margin:0;padding:0 24px;font-size:14px;line-height:22px;font-weight:400;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.sd-body{display:flex;flex-direction:column;gap:8px;min-width:0;margin-top:20px;padding:0 24px}
.sd-details{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.sd-detail{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.sd-dot{flex:none;width:4px;height:4px;margin:7px 0 0;border-radius:50%;background:var(--dsw-alias-label-secondary)}
.sd-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.sd-status{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.sd-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 24px}
.sd-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:36px;padding:0 14px;border:none;border-radius:var(--dsw-radius-md);cursor:pointer;font-size:14px;line-height:22px;font-family:inherit;color:var(--dsw-alias-label-primary);background:transparent}
.sd-button:disabled{cursor:not-allowed;opacity:.4}
.sd-button-outline{border:.5px solid var(--dsw-alias-border-l3);background:transparent}
.sd-button-outline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.sd-button-danger:not(:disabled){color:var(--dsw-alias-state-error-primary)}
`;

    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = STYLE_ID;
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ----------------------------------------------------------------- store
    /** Minimal snapshot store the slot engine can bind as a selector hook. */
    function createStore(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set: (next) => {
          if (next === value) return;
          value = next;
          for (const listener of [...listeners]) listener();
        },
      };
    }

    /** Pending confirmation: `{ sessionId, displayTitle }` or `null`. */
    const requestStore = createStore(null);

    // ----------------------------------------------------------------- icons
    function IconTrash({ size = 14 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M2.8 4.2h10.4' }),
        h('path', { d: 'M6.4 4.2V3.1a.9.9 0 0 1 .9-.9h1.4a.9.9 0 0 1 .9.9v1.1' }),
        h('path', { d: 'M4.3 4.2l.6 8.4a1.2 1.2 0 0 0 1.2 1.1h3.8a1.2 1.2 0 0 0 1.2-1.1l.6-8.4' }),
        h('path', { d: 'M6.7 7v4.2M9.3 7v4.2' }),
      );
    }

    function IconClose({ size = 14 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M4 4l8 8M12 4l-8 8' }),
      );
    }

    // ------------------------------------------------------------- menu item
    /**
     * One "..." menu row: opens the confirmation instead of deleting directly.
     * @param props - owner share (`sessionId`, `displayTitle`), the menu state hook, and the locale seat.
     * @returns the row.
     */
    function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, t }) {
      const [, setMenuOpen] = useMenuOpenState();
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'sd-menu-item sd-menu-item-danger',
          onClick: () => {
            setMenuOpen(false);
            requestStore.set({ sessionId, displayTitle: displayTitle ?? '' });
          },
        },
        h('span', { className: 'sd-icon' }, h(IconTrash, { size: 14 })),
        h('span', null, t('menu.delete')),
      );
    }

    // ---------------------------------------------------------------- dialog
    const TITLE_ID = 'sd-session-delete-title';
    const DESC_ID = 'sd-session-delete-desc';

    /**
     * The frame-wide overlay entry: nothing while no confirmation is pending.
     * @param props - the pending-request hook, its settlement, and the delete hop.
     * @returns the open dialog, or null.
     */
    function DeleteSessionDialog({ useDeleteRequest, settleDelete, confirmDelete, t }) {
      const request = useDeleteRequest((pending) => pending);
      if (request === null) return null;
      return h(DeleteSessionForm, { key: request.sessionId, request, settleDelete, confirmDelete, t });
    }

    /** One request's dialog: in-flight and error state die with it. */
    function DeleteSessionForm({ request, settleDelete, confirmDelete, t }) {
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const dialogRef = React.useRef(null);
      const title = request.displayTitle !== '' ? request.displayTitle : t('dialog.untitled');

      const close = React.useCallback(() => {
        if (busy) return;
        settleDelete();
      }, [busy, settleDelete]);

      React.useEffect(() => {
        dialogRef.current?.focus();
      }, []);

      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
          }
          if (event.key !== 'Tab') return;
          const dialog = dialogRef.current;
          if (dialog === null) return;
          const focusable = [...dialog.querySelectorAll('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;
          if (event.shiftKey && (active === first || active === dialog)) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      }, [close]);

      const submit = () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        Promise.resolve()
          .then(() => confirmDelete(request.sessionId))
          .then(() => {
            settleDelete();
          })
          .catch((reason) => {
            setBusy(false);
            setError(reason instanceof Error ? reason.message : String(reason));
          });
      };

      return h(
        'div',
        { className: 'sd-root', role: 'presentation' },
        h('div', {
          className: 'sd-mask',
          'aria-hidden': true,
          onClick: () => {
            close();
          },
        }),
        h(
          'div',
          {
            ref: dialogRef,
            className: 'sd-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': TITLE_ID,
            'aria-describedby': DESC_ID,
            tabIndex: -1,
          },
          h(
            'div',
            { className: 'sd-header' },
            h('h2', { id: TITLE_ID, className: 'sd-title' }, t('dialog.title')),
            h(
              'button',
              {
                type: 'button',
                className: 'sd-close',
                'aria-label': t('dialog.close'),
                disabled: busy,
                onClick: close,
              },
              h(IconClose, { size: 14 }),
            ),
          ),
          h('p', { id: DESC_ID, className: 'sd-description' }, t('dialog.desc', { title })),
          h(
            'div',
            { className: 'sd-body' },
            h(
              'ul',
              { className: 'sd-details' },
              ['dialog.detail.log', 'dialog.detail.cache', 'dialog.detail.markers'].map((key) =>
                h(
                  'li',
                  { key, className: 'sd-detail' },
                  h('span', { className: 'sd-dot', 'aria-hidden': true }),
                  h('span', null, t(key)),
                ),
              ),
            ),
            busy ? h('p', { className: 'sd-status', role: 'status' }, t('dialog.busy')) : null,
            error !== null ? h('p', { className: 'sd-error', role: 'alert' }, t('dialog.error', { message: error })) : null,
          ),
          h(
            'div',
            { className: 'sd-footer' },
            h(
              'button',
              { type: 'button', className: 'sd-button sd-button-outline', disabled: busy, onClick: close },
              t('dialog.cancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'sd-button sd-button-outline sd-button-danger',
                disabled: busy,
                onClick: submit,
              },
              t('dialog.confirm'),
            ),
          ),
        ),
      );
    }

    // -------------------------------------------------------------- language
    const ZH = {
      'menu.delete': '删除会话',
      'dialog.title': '删除会话',
      'dialog.desc': '“{title}”的全部本地数据将被永久删除，且无法恢复。',
      'dialog.detail.log': '会话日志与运行记录',
      'dialog.detail.cache': '投影缓存与恢复检查点',
      'dialog.detail.markers': '置顶与归档标记',
      'dialog.untitled': '未命名会话',
      'dialog.cancel': '取消',
      'dialog.confirm': '永久删除',
      'dialog.busy': '正在删除…',
      'dialog.error': '删除失败：{message}',
      'dialog.close': '关闭',
    };

    const EN = {
      'menu.delete': 'Delete session',
      'dialog.title': 'Delete session',
      'dialog.desc': 'All local data for “{title}” will be permanently deleted and cannot be recovered.',
      'dialog.detail.log': 'Session log and run records',
      'dialog.detail.cache': 'Projection cache and resume checkpoints',
      'dialog.detail.markers': 'Pin and archive markers',
      'dialog.untitled': 'Untitled session',
      'dialog.cancel': 'Cancel',
      'dialog.confirm': 'Delete permanently',
      'dialog.busy': 'Deleting…',
      'dialog.error': 'Deletion failed: {message}',
      'dialog.close': 'Close',
    };

    // ------------------------------------------------------------------ apply
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'session-delete: dictionaries');

        const currentSessionId = () => {
          try {
            const list = ctx.get('sessions')?.list?.getSnapshot?.();
            for (const summary of Object.values(list?.byId ?? {})) {
              if ((summary?.retainedBy?.mainView ?? 0) > 0) return summary.id;
            }
          } catch (error) {
            console.warn('[session-delete] current session lookup failed:', error);
          }
          return undefined;
        };

        const requestDeletion = async (sessionId) => {
          const response = await fetch(DELETE_ROUTE, {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
          }
          return payload.value;
        };

        const confirmDelete = async (sessionId) => {
          const wasCurrent = currentSessionId() === sessionId;
          const value = await requestDeletion(sessionId);
          if (wasCurrent) {
            try {
              ctx.get('uiWorkspace')?.startSession?.();
            } catch (error) {
              console.warn('[session-delete] opening a fresh session failed:', error);
            }
          }
          return value;
        };

        const settleDelete = () => requestStore.set(null);

        ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
          ctx.slots.register(
            {
              name: 'sidebar.workspaces.session.menu.item',
              id: 'session-delete',
              order: 500,
              locale: NS,
            },
            DeleteSessionMenuItem,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'session-delete-confirm',
              order: 50,
              locale: NS,
              inject: () => ({
                hooks: { deleteRequest: requestStore },
                settleDelete,
                confirmDelete,
              }),
            },
            DeleteSessionDialog,
          ),
        );
      },
    };
  },
});
