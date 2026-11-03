// dsh-bookshelf — Client half.
// Registers a sidebar panel entry (with icon) and the full bookshelf page in the `main` slot.
// Visible UI text routes through the Client locale service; styles reference only theme tokens.

window.__ModuleLoader__.load({
  id: '@local/dsh-bookshelf',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const API = '/dsh-bookshelf/api';
    const BOOK_ACCEPT = '.epub,.pdf,.txt,.md,.mobi,.azw3,.docx';
    const NS = 'dsh-bookshelf';

    const DICTS = {
      zh: {
        panelLabel: '书架',
        shelfTitle: '我的书架',
        searchPlaceholder: '搜索书名 / 作者',
        upload: '上传图书',
        removeBook: '从书架移除',
        emptyShelf: '书架还是空的，点击「上传图书」或把书籍文件拖进来',
        noMatch: '没有匹配的书籍',
        chatTitle: '书架助手',
        chatIdle: '未选择图书，与书库助手自由聊天',
        chatReading: (t) => `正在陪你读《${t}》`,
        chatEmptyBook: (t) => `选好了《${t}》，问我任何关于这本书的问题，或者让我带你读书。`,
        chatEmpty: '在左侧选中一本书开始对话，或者直接聊聊阅读。',
        composerPlaceholder: '向书架助手提问…',
        send: '发送',
        newChat: '新对话',
        thinking: '正在思考…',
        askLabel: '向书架助手提问',
        searchLabel: '搜索书名或作者',
        failedAnswer: '（这次回答失败了，请重试。）',
        noContent: '（无内容）',
        chatHandoff: '发送后将在原生对话中由书架助手回答（会读原书、可多轮追问）',
      },
      en: {
        panelLabel: 'Bookshelf',
        shelfTitle: 'My Bookshelf',
        searchPlaceholder: 'Search title / author',
        upload: 'Upload Books',
        removeBook: 'Remove from shelf',
        emptyShelf: 'Your shelf is empty — click "Upload Books" or drop book files here',
        noMatch: 'No matching books',
        chatTitle: 'Shelf Assistant',
        chatIdle: 'No book selected — chat freely about your library',
        chatReading: (t) => `Reading "${t}" with you`,
        chatEmptyBook: (t) => `"${t}" is selected. Ask anything about this book, or let me guide your reading.`,
        chatEmpty: 'Select a book on the left to start, or just chat about reading.',
        composerPlaceholder: 'Ask the shelf assistant…',
        send: 'Send',
        newChat: 'New chat',
        thinking: 'Thinking…',
        askLabel: 'Ask the shelf assistant',
        searchLabel: 'Search title or author',
        failedAnswer: '(This answer failed — please try again.)',
        noContent: '(No content)',
        chatHandoff: 'Your question opens a native conversation answered by the Shelf Assistant (reads the book, supports follow-ups)',
      },
    };

    function makeT(ctx) {
      const localeId = ctx.locale?.getLocale?.().locale ?? 'zh';
      const dict = DICTS[localeId === 'en' ? 'en' : 'zh'] ?? DICTS.zh;
      return (key, ...args) => {
        const v = dict[key];
        return typeof v === 'function' ? v(...args) : v ?? key;
      };
    }

    // ---------- styles (theme tokens only, with readable fallbacks) ----------

    const css = `
.bk-root { display: flex; position: relative; height: 100%; min-height: 0; background: #17171b; color: #e8e8ec; font-size: 13px; }
.bk-shelf { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
.bk-shelf-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px 8px; }
.bk-title { font-size: 18px; font-weight: 600; margin-right: 4px; }
.bk-count { color: #9a9aa3; font-size: 12px; border: 1px solid #33333b; border-radius: 8px; padding: 1px 8px; }
.bk-search { flex: 1 1 auto; max-width: 320px; margin-left: auto; }
.bk-search input { width: 100%; box-sizing: border-box; background: #212128; color: #e8e8ec; border: 1px solid #33333b; border-radius: 8px; padding: 6px 10px; font-size: 12px; outline: none; }
.bk-search input:focus { border-color: #4d7dfd; }
.bk-search input::placeholder { color: #9a9aa3; }
.bk-btn { background: #3b6ef0; color: #ffffff; border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; font-weight: 500; }
.bk-btn:disabled { opacity: .5; cursor: default; }
.bk-btn-ghost { background: #212128; color: #e8e8ec; border: 1px solid #33333b; }
.bk-grid-wrap { flex: 1 1 auto; overflow-y: auto; padding: 8px 20px 20px; }
.bk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 18px 16px; align-content: start; }
.bk-drop { border: 1.5px dashed #3d3d47; border-radius: 12px; transition: border-color .15s, background .15s; height: 100%; box-sizing: border-box; }
.bk-drop.over { border-color: #4d7dfd; background: #212128; }
.bk-card { position: relative; cursor: pointer; border: none; background: none; padding: 0; text-align: left; color: inherit; }
.bk-card .bk-cover { width: 100%; aspect-ratio: 3 / 4; border-radius: 8px; overflow: hidden; background: #212128; border: 1px solid #33333b; display: flex; align-items: center; justify-content: center; }
.bk-card.selected .bk-cover { outline: 2px solid #4d7dfd; outline-offset: 2px; }
.bk-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bk-cover-fallback { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 10px; box-sizing: border-box; gap: 6px; background: linear-gradient(160deg, #292932, #212128); }
.bk-cover-fallback .t { font-weight: 600; font-size: 13px; text-align: center; line-height: 1.3; word-break: break-word; color: #e8e8ec; }
.bk-cover-fallback .f { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #9a9aa3; }
.bk-card .bk-meta { margin-top: 8px; }
.bk-card .bk-book-title { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e8e8ec; }
.bk-card .bk-author { font-size: 11px; color: #9a9aa3; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-remove { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; border-radius: 6px; border: none; background: #2c2c35; color: #e8e8ec; cursor: pointer; display: none; align-items: center; justify-content: center; font-size: 12px; padding: 0; line-height: 1; }
.bk-card:hover .bk-remove { display: flex; }
.bk-remove:hover { color: #e5484d; }
.bk-empty { color: #9a9aa3; padding: 48px 0; text-align: center; }
/* Chat column — visual language follows the native conversation view */
.bk-chat { width: 380px; flex: 0 0 380px; border-left: 1px solid #33333b; display: flex; flex-direction: column; min-height: 0; background: #17171b; }
.bk-chat-head { padding: 14px 20px 10px; border-bottom: 1px solid #33333b; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.bk-chat-title { font-weight: 600; font-size: 14px; color: #e8e8ec; }
.bk-chat-new { background: none; border: none; color: #9a9aa3; font-size: 11px; cursor: pointer; padding: 2px 4px; }
.bk-chat-new:hover { color: #e8e8ec; }
.bk-chat-sub { font-size: 11px; color: #9a9aa3; padding: 8px 20px 0; }
.bk-msgs { flex: 1 1 auto; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.bk-msg { font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.bk-msg.user { align-self: flex-end; max-width: 88%; background: #292932; border: 1px solid #33333b; color: #e8e8ec; border-radius: 14px; padding: 9px 14px; }
.bk-msg.assistant { align-self: stretch; color: #e8e8ec; }
.bk-msg.assistant .bk-msg-book { font-size: 11px; color: #9a9aa3; margin-bottom: 4px; }
.bk-msg.pending { color: #9a9aa3; }
.bk-chat-empty { color: #9a9aa3; font-size: 12px; margin: auto; text-align: center; padding: 0 24px; line-height: 1.8; }
.bk-chat-empty .bk-chat-empty-title { font-size: 15px; font-weight: 600; color: #e8e8ec; margin-bottom: 8px; }
.bk-error { color: #e5484d; font-size: 11px; padding: 4px 20px 6px; }
.bk-composer { padding: 12px 16px 16px; }
.bk-composer-card { display: flex; align-items: flex-end; gap: 8px; background: #212128; border: 1px solid #33333b; border-radius: 16px; padding: 8px 8px 8px 14px; }
.bk-composer-card:focus-within { border-color: #3d3d47; }
.bk-composer textarea { flex: 1 1 auto; resize: none; max-height: 120px; background: transparent; color: #e8e8ec; border: none; padding: 4px 0; font-size: 13px; line-height: 1.5; font-family: inherit; outline: none; }
.bk-composer textarea::placeholder { color: #9a9aa3; }
.bk-send { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 10px; border: none; background: #3b6ef0; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
.bk-send:disabled { opacity: .45; cursor: default; }
`;

    // ---------- sidebar icon (the panellist slot renders this as the glyph) ----------

    function BookIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 18;
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': true,
        style: { display: 'block', color: 'inherit' },
      }, h('g', {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
        h('path', { d: 'M12 6.5c-1.8-1.6-4.2-1.9-6.5-1v12.2c2.3-.9 4.7-.6 6.5 1 1.8-1.6 4.2-1.9 6.5-1V5.5c-2.3-.9-4.7-.6-6.5 1z' }),
        h('path', { d: 'M12 6.5v12.2' }),
      ));
    }

    // ---------- API helpers ----------

    async function apiGet(path) {
      const res = await fetch(API + path);
      if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
      return res.json();
    }
    async function apiPost(path, body) {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `POST ${path}: ${res.status}`);
      return data;
    }
    async function apiUpload(file) {
      const res = await fetch(`${API}/upload?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `upload ${file.name}: ${res.status}`);
      return data;
    }

    // ---------- components ----------

    function BookCard({ t, book, selected, onSelect }) {
      return h('div', { className: 'bk-card' + (selected ? ' selected' : '') },
        h('div', {
          className: 'bk-cover', role: 'button', tabIndex: 0,
          onClick: () => onSelect(book),
          onKeyDown: (e) => { if (e.key === 'Enter') onSelect(book); },
          title: book.title,
        },
          book.cover
            ? h('img', { src: book.cover, alt: book.title })
            : h('div', { className: 'bk-cover-fallback' },
                h('div', { className: 't' }, book.title),
                h('div', { className: 'f' }, book.format)),
        ),
        h('div', { className: 'bk-meta' },
          h('div', { className: 'bk-book-title' }, book.title),
          book.author ? h('div', { className: 'bk-author' }, book.author) : null),
      );
    }

    function Bookshelf(props) {
      const { t, books, query, setQuery, onSelect, onUploadClick, dragging, setDragging, onDropFiles } = props;
      const filtered = books.filter((b) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${b.title} ${b.author}`.toLowerCase().includes(q);
      });
      return h('div', { className: 'bk-shelf' },
        h('div', { className: 'bk-shelf-head' },
          h('span', { className: 'bk-title' }, t('shelfTitle')),
          h('span', { className: 'bk-count' }, String(books.length)),
          h('div', { className: 'bk-search' },
            h('input', {
              placeholder: t('searchPlaceholder'),
              value: query,
              onChange: (e) => setQuery(e.target.value),
              'aria-label': t('searchLabel'),
            })),
          h('button', { className: 'bk-btn', onClick: onUploadClick }, t('upload'))),
        h('div', {
          className: 'bk-grid-wrap',
          onDragOver: (e) => { e.preventDefault(); setDragging(true); },
          onDragLeave: () => setDragging(false),
          onDrop: (e) => { e.preventDefault(); setDragging(false); onDropFiles(e.dataTransfer?.files); },
        },
          h('div', { className: 'bk-drop' + (dragging ? ' over' : ''), style: { padding: '14px' } },
            filtered.length === 0
              ? h('div', { className: 'bk-empty' }, books.length === 0 ? t('emptyShelf') : t('noMatch'))
              : h('div', { className: 'bk-grid' },
                  filtered.map((b) => h(BookCard, {
                    key: b.id, t, book: b, onSelect,
                  })))),
        ));
    }

    function BookshelfPage({ t, onChat }) {
      const [books, setBooks] = React.useState([]);
      const [query, setQuery] = React.useState('');
      const [error, setError] = React.useState('');
      const [dragging, setDragging] = React.useState(false);
      const fileRef = React.useRef(null);

      const refresh = React.useCallback(async () => {
        try {
          setBooks(await apiGet('/books'));
        } catch (e) {
          setError(String(e.message || e));
        }
      }, []);
      React.useEffect(() => { void refresh(); }, [refresh]);

      const addFiles = React.useCallback(async (fileList) => {
        if (!fileList || fileList.length === 0) return;
        setError('');
        const files = Array.from(fileList);
        let okCount = 0;
        for (const f of files) {
          try {
            await apiUpload(f);
            okCount += 1;
          } catch (e) {
            setError(`${f.name}: ${String(e.message || e)}`);
          }
        }
        if (okCount > 0) await refresh();
      }, [refresh]);

      // Selecting a book opens the real conversation: the native session with
      // the bookshelf assistant preset restores memory from the book folder's
      // reading-log.md, then continues guiding the reading.
      const chatWithBook = React.useCallback(async (book) => {
        const folder = book.folder || book.title;
        const question = `我在读《${book.title}》${book.author ? `（作者：${book.author}）` : ''}。请先读 "${folder}/reading-log.md" 恢复我们上次的阅读进度和讨论记忆（如果日志还是空的，就从第一篇开始），然后继续带我读。`;
        setError('');
        try {
          await onChat(question);
        } catch (e) {
          setError(String(e.message || e));
        }
      }, [onChat]);

      return h('div', { className: 'bk-root' },
        h('style', null, css),
        h('input', {
          ref: fileRef, type: 'file', multiple: true, accept: BOOK_ACCEPT, style: { display: 'none' },
          onChange: (e) => { void addFiles(e.target.files); e.target.value = ''; },
        }),
        h(Bookshelf, {
          t, books, query, setQuery, onSelect: (b) => void chatWithBook(b),
          onUploadClick: () => fileRef.current?.click(),
          dragging, setDragging,
          onDropFiles: (files) => void addFiles(files),
        }),
        error ? h('div', { style: { position: 'absolute', left: 12, bottom: 12, background: '#2c2c35', color: '#e5484d', border: '1px solid #e5484d', borderRadius: 8, padding: '6px 12px', fontSize: 12, maxWidth: 520, zIndex: 10 } }, error) : null,
      );
    }

    return {
      inject: ['slots', 'layout', 'locale', 'uiWorkspace'],
      apply(ctx) {
        // Locale dictionary for the sidebar panel label.
        ctx.locale.register(NS, {
          zh: { panelLabel: DICTS.zh.panelLabel },
          en: { panelLabel: DICTS.en.panelLabel },
        });

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'dsh-bookshelf',
          order: 60,
          label: () => ctx.locale.bind(NS)('panelLabel'),
        }, BookIcon));
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'dsh-bookshelf',
        }, () => h(BookshelfPage, {
          t: makeT(ctx),
          // Same navigation the guizang plugin uses: startSession with the
          // dedicated 图书 workspace id; it opens the workspace, starts the
          // session with the preset, and prepares the prefilled draft itself.
          onChat: async (question) => {
            const { id } = await apiGet('/workspace');
            ctx.uiWorkspace.startSession(id, {
              agentPreset: 'bookshelf',
              prompt: question,
              whenDraftExists: 'replace',
            });
          },
        })));
      },
    };
  },
});
