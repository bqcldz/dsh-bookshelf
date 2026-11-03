// dsh-bookshelf — Host half.
// Owns the local library storage and a small HTTP API under /dsh-bookshelf/api
// that the Client panel calls with same-origin fetch.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir, readdir, copyFile, unlink, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';

const BOOK_EXTENSIONS = new Set(['.epub', '.pdf', '.txt', '.md', '.mobi', '.azw3', '.docx']);
const TEXT_EXTRACT_EXTENSIONS = new Set(['.txt', '.md', '.epub', '.docx']);
const MAX_TEXT_CHARS = 24000;

// The library IS the user-visible 图书 project folder; the plugin is only a
// window onto it. Legacy location for one-time migration below.
const libraryRoot = join(homedir(), 'Documents', '图书');
const legacyRoot = join(homedir(), '.dsh', 'plugin-data', 'dsh-bookshelf', 'library');
const coversDir = join(libraryRoot, 'covers');
const indexPath = join(libraryRoot, 'index.json');

async function ensureDirs() {
  if (!existsSync(coversDir)) await mkdir(coversDir, { recursive: true });
}

// One-time move of the old hidden plugin-data library into ~/Documents/图书.
async function migrateLegacyLibrary() {
  if (!existsSync(legacyRoot)) return;
  if (existsSync(indexPath)) return; // new root already live
  await mkdir(libraryRoot, { recursive: true });
  for (const name of await readdir(legacyRoot)) {
    const src = join(legacyRoot, name);
    const dst = join(libraryRoot, name);
    if (existsSync(dst)) continue;
    await rename(src, dst);
  }
}

async function readIndex() {
  await ensureDirs();
  try {
    return JSON.parse(await readFile(indexPath, 'utf8'));
  } catch {
    return [];
  }
}

async function writeIndex(list) {
  await ensureDirs();
  await writeFile(indexPath, JSON.stringify(list, null, 2), 'utf8');
}

// ---------- per-book folders + AGENTS.md protocol ----------

const AGENTS_MD = `<!-- dsh-bookshelf v1 -->
# 书库操作手册（本地阅读数据库）

这里是用户的私人书库，也是一套以 Markdown 文件承载的阅读记忆数据库。
你的职责：领读 + 按下面的协议维护这套数据库的记忆文件。

## 数据库结构
- \`index.json\`：书目目录（插件维护，你只读，绝不修改）
- \`<书名>/\`：每本书的独立文件夹
  - \`<书名>.epub|pdf|txt|md|docx|mobi\`：原书文件（只读，绝不修改）
  - \`reading-log.md\`：这本书的阅读记忆（核心数据表，你负责读写）
  - \`notes/*.md\`：沉淀笔记（按话题自由建文件，如金句摘抄、人物笔记）

## 读取协议（每次对话开始时）
1. 用户提到某本书 → 进入 \`<书名>/\` 文件夹
2. 先读 reading-log.md：「当前进度」+「留给下次」是恢复上下文的钥匙
3. 按「下次从哪里继续」继续领读，不要重复已讨论的内容
4. 尊重用户对 reading-log.md 的手动修改——那是最高优先级的指令

## 写入协议（何时更新 reading-log.md）
- 用户说「先到这 / 今天就读到这 / 更新日志」时 → 立即更新
- 完成一篇/一章的讨论后 → 更新
- 不要每轮对话都写盘；更新是「合并」不是「覆盖」：
  - 「已读与讨论记录」按天追加（### Day N · 日期 · 篇目）
  - 「当前进度」「留给下次」整体重写为最新状态
  - 顶部「最后更新」日期同步刷新

## 数据规则
- reading-log.md 固定骨架：当前进度 / 读者画像 / 已读与讨论记录 /
  留给下次 / 金句（缺的章节可留空，不要删骨架）
- 读者画像只记阅读偏好（节奏、兴趣、情绪反应），不记隐私
- 用户夸某句原文 → 同时追加到 notes/金句摘抄.md
- 删除操作只允许用户手动做；你永远不删除任何文件

## 边界
- index.json、covers/、原书文件：只读
- 不在书库根目录新建文件；所有笔记写入对应书籍的 notes/
`;

function folderNameFor(title, id) {
  const name = String(title ?? '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return name || id;
}

function readingLogSkeleton(title) {
  return `# 《${title}》阅读日志

> 书架助手维护 · 最后更新：尚未开始

## 当前进度
- 还未开始阅读

## 读者画像
（待积累）

## 已读与讨论记录
（待积累）

## 留给下次
（无）

## 金句
（待摘抄）
`;
}

// Idempotent: writes/updates AGENTS.md and migrates flat book files into
// per-book folders with an initial reading-log.md.
async function ensureStructure() {
  await migrateLegacyLibrary();
  await ensureDirs();
  const agentsPath = join(libraryRoot, 'AGENTS.md');
  let current = '';
  try { current = await readFile(agentsPath, 'utf8'); } catch { /* missing */ }
  if (!current.includes('<!-- dsh-bookshelf v1 -->')) {
    await writeFile(agentsPath, AGENTS_MD, 'utf8');
  }
  const list = await readIndex();
  let dirty = false;
  for (const book of list) {
    if (book.folder) continue;
    book.folder = folderNameFor(book.title, book.id);
    const dir = join(libraryRoot, book.folder);
    await mkdir(dir, { recursive: true });
    const src = join(libraryRoot, book.file);
    const dst = join(dir, book.file);
    if (existsSync(src)) {
      await copyFile(src, dst);
      await unlink(src);
    }
    const log = join(dir, 'reading-log.md');
    if (!existsSync(log)) await writeFile(log, readingLogSkeleton(book.title), 'utf8');
    dirty = true;
  }
  if (dirty) await writeIndex(list);
}

function bookPath(book) {
  return join(libraryRoot, book.folder ?? '', book.file);
}

// ---------- minimal zip reader (epub / docx) ----------

function zipEntries(buffer) {
  // Locate End Of Central Directory record.
  const eocdSig = 0x06054b50;
  let eocd = -1;
  const min = Math.max(0, buffer.length - 66000);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === eocdSig) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function zipRead(buffer, entry) {
  // Local file header: skip its name + extra fields.
  const lo = entry.localOffset;
  const nameLen = buffer.readUInt16LE(lo + 26);
  const extraLen = buffer.readUInt16LE(lo + 28);
  const start = lo + 30 + nameLen + extraLen;
  const data = buffer.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip method ${entry.method} for ${entry.name}`);
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEpub(buffer) {
  const entries = zipEntries(buffer);
  const result = { text: '', cover: null };
  const docs = [];
  let coverEntry = null;
  for (const entry of entries) {
    const lower = entry.name.toLowerCase();
    if (!coverEntry && /(cover|front)[^/]*\.(jpe?g|png)$/i.test(lower)) coverEntry = entry;
    if (/\.(xhtml|html|htm)$/i.test(lower)) docs.push(entry);
  }
  docs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const parts = [];
  for (const doc of docs) {
    try {
      parts.push(stripHtml(zipRead(buffer, doc).toString('utf8')));
    } catch { /* skip broken entry */ }
    if (parts.join('').length > MAX_TEXT_CHARS * 2) break;
  }
  result.text = parts.join('\n');
  if (coverEntry) {
    try {
      const img = zipRead(buffer, coverEntry);
      const ext = /\.(png)$/i.test(coverEntry.name) ? 'png' : 'jpg';
      result.cover = { data: img, ext };
    } catch { /* no cover */ }
  }
  return result;
}

function extractDocx(buffer) {
  const entries = zipEntries(buffer);
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) return { text: '', cover: null };
  const xml = zipRead(buffer, doc).toString('utf8');
  const paragraphs = xml.split(/<\/w:p>/).map((p) => stripHtml(p)).filter(Boolean);
  return { text: paragraphs.join('\n'), cover: null };
}

async function extractText(filePath, ext) {
  if (!TEXT_EXTRACT_EXTENSIONS.has(ext)) return '';
  try {
    const buffer = await readFile(filePath);
    if (ext === '.txt' || ext === '.md') return buffer.toString('utf8');
    if (ext === '.epub') return extractEpub(buffer).text;
    if (ext === '.docx') return extractDocx(buffer).text;
  } catch { /* unreadable */ }
  return '';
}

async function extractCover(filePath, ext, bookId) {
  if (ext !== '.epub') return null;
  try {
    const buffer = await readFile(filePath);
    const { cover } = extractEpub(buffer);
    if (cover) {
      const file = `${bookId}.${cover.ext}`;
      await writeFile(join(coversDir, file), cover.data);
      return file;
    }
  } catch { /* no cover */ }
  return null;
}

// ---------- metadata ----------

function splitName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
  const dash = base.split(/\s+[-—–]\s+/);
  if (dash.length >= 2) return { title: dash[0].trim(), author: dash.slice(1).join(' ').trim() };
  return { title: base, author: '' };
}

async function importOneFile(srcPath, fileName) {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (!BOOK_EXTENSIONS.has(ext)) return null;
  const list = await readIndex();
  const id = randomUUID();
  const { title, author } = splitName(fileName);
  const folder = folderNameFor(title || fileName, id);
  const destName = `${id}${ext}`;
  const dir = join(libraryRoot, folder);
  await mkdir(dir, { recursive: true });
  const destPath = join(dir, destName);
  await copyFile(srcPath, destPath);
  const cover = await extractCover(destPath, ext, id);
  const logPath = join(dir, 'reading-log.md');
  if (!existsSync(logPath)) await writeFile(logPath, readingLogSkeleton(title || fileName), 'utf8');
  const book = {
    id,
    title: title || fileName,
    author,
    format: ext.slice(1),
    folder,
    file: destName,
    cover,
    addedAt: Date.now(),
  };
  list.push(book);
  await writeIndex(list);
  return book;
}

// ---------- llm chat ----------

function textBlock(text) {
  return [{ type: 'text', text }];
}

async function runChat(ctx, { bookId, message, history }) {
  const llm = ctx.get('llm');
  const modelSvc = ctx.get('agentDefaultModel');
  if (!llm || !modelSvc) throw new Error('llm service unavailable');
  const selection = modelSvc.currentSelection?.();
  if (!selection?.provider || !selection?.model) throw new Error('no default model selected');

  let bookContext = '';
  let bookTitle = '';
  if (bookId) {
    const list = await readIndex();
    const book = list.find((b) => b.id === bookId);
    if (book) {
      bookTitle = book.title;
      const filePath = bookPath(book);
      const text = await extractText(filePath, `.${book.format}`);
      if (text) {
        bookContext = `以下是《${book.title}》${book.author ? `（作者：${book.author}）` : ''}的正文摘录，回答时优先依据这些内容：\n\n${text.slice(0, MAX_TEXT_CHARS)}`;
      } else {
        bookContext = `用户选中了《${book.title}》${book.author ? `（作者：${book.author}）` : ''}，但该书格式（${book.format}）暂不支持正文提取，请基于你的知识回答并说明这一点。`;
      }
    }
  }

  const systemText = bookContext
    ? `你是书架助手，一位耐心专业的领读人。${bookContext}\n\n用中文回答，条理清晰，适当引用原文；用户可能想让你"带他读书"，此时给出导读要点和思考问题。`
    : '你是书架助手，帮用户管理本地书架并聊聊书籍相关的话题。用中文回答。';

  const messages = [{ role: 'system', content: textBlock(systemText) }];
  for (const item of Array.isArray(history) ? history.slice(-12) : []) {
    if (item?.role === 'user') {
      messages.push({ role: 'user', content: textBlock(String(item.content ?? '')), source: { kind: 'user' } });
    } else if (item?.role === 'assistant') {
      // Assistant history needs a model source per the host message protocol;
      // without `source` the stream adapter crashes reading `replayState`.
      messages.push({
        role: 'assistant',
        content: textBlock(String(item.content ?? '')),
        source: { kind: 'model', provider: 'bookshelf-history', model: 'bookshelf-history' },
      });
    }
  }
  messages.push({ role: 'user', content: textBlock(String(message ?? '')), source: { kind: 'user' } });

  const stream = llm.stream({ provider: selection.provider, model: selection.model, messages });
  let out = '';
  for await (const chunk of stream) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') out += chunk.text;
    if (chunk?.type === 'finish' && chunk.reason?.kind === 'error') {
      throw new Error(chunk.reason.failure?.message || 'model call failed');
    }
  }
  return out;
}

// ---------- http helpers ----------

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBodyJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

function publicBook(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    format: book.format,
    folder: book.folder ?? null,
    cover: book.cover ? `/dsh-bookshelf/api/cover/${book.id}` : null,
    addedAt: book.addedAt,
  };
}

// ---------- plugin entry ----------

// Declare the dependency so activation waits until the web server is ready;
// looking it up eagerly without `inject` races the service on cold start.
export const inject = ['webServer', 'workspaceRegistry'];

export function apply(ctx) {
  return ctx.effect(() => {
    const webServer = ctx.get('webServer');
    if (!webServer) throw new Error('webServer service unavailable');

    // Resolve (or create once) the dedicated "图书" workspace backed by the
    // The 图书 workspace must point at the user-visible library folder; if an
    // old entry still points at the legacy hidden dir, replace it.
    async function ensureBookWorkspace() {
      const registry = ctx.get('workspaceRegistry');
      if (!registry) throw new Error('workspaceRegistry service unavailable');
      const existing = registry.list().find((w) => w.title === '图书');
      if (existing && existing.path === libraryRoot) return existing;
      if (existing) {
        try { registry.delete(existing.id); } catch { /* keep going */ }
      }
      return registry.create(libraryRoot, '图书');
    }

    return webServer.register({
      kind: 'prefix',
      path: '/dsh-bookshelf/api',
      async handler(req, res) {
        const url = new URL(req.url ?? '/', 'http://x');
        const path = url.pathname;
        try {
          await ensureStructure();
          if (req.method === 'GET' && path === '/dsh-bookshelf/api/books') {
            const list = await readIndex();
            return json(res, 200, list.map(publicBook));
          }
          if (req.method === 'GET' && path === '/dsh-bookshelf/api/workspace') {
            const workspace = await ensureBookWorkspace();
            return json(res, 200, { id: workspace.id });
          }
          if (req.method === 'POST' && path === '/dsh-bookshelf/api/import') {
            const body = await readBodyJson(req);
            const srcPath = String(body.path ?? '');
            const fileName = String(body.name ?? srcPath.split('/').pop() ?? '');
            if (!srcPath || !fileName) return json(res, 400, { error: 'path and name required' });
            const book = await importOneFile(srcPath, fileName);
            return json(res, book ? 200 : 400, book ? publicBook(book) : { error: 'unsupported format' });
          }
          if (req.method === 'POST' && path === '/dsh-bookshelf/api/upload') {
            // Binary body; original file name in ?name=
            const fileName = url.searchParams.get('name') ?? 'book.epub';
            await ensureDirs();
            const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
            if (!BOOK_EXTENSIONS.has(ext)) return json(res, 400, { error: 'unsupported format' });
            const id = randomUUID();
            const { title, author } = splitName(fileName);
            const folder = folderNameFor(title || fileName, id);
            const destName = `${id}${ext}`;
            const dir = join(libraryRoot, folder);
            await mkdir(dir, { recursive: true });
            const destPath = join(dir, destName);
            const chunks = [];
            for await (const c of req) chunks.push(c);
            await writeFile(destPath, Buffer.concat(chunks));
            const cover = await extractCover(destPath, ext, id);
            const logPath = join(dir, 'reading-log.md');
            if (!existsSync(logPath)) await writeFile(logPath, readingLogSkeleton(title || fileName), 'utf8');
            const list = await readIndex();
            const record = { id, title: title || fileName, author, format: ext.slice(1), folder, file: destName, cover, addedAt: Date.now() };
            list.push(record);
            await writeIndex(list);
            return json(res, 200, publicBook(record));
          }
          if (req.method === 'POST' && path === '/dsh-bookshelf/api/remove') {
            const body = await readBodyJson(req);
            const list = await readIndex();
            const book = list.find((b) => b.id === body.id);
            if (!book) return json(res, 404, { error: 'not found' });
            try { await unlink(bookPath(book)); } catch { /* already gone */ }
            if (book.cover) { try { await unlink(join(coversDir, book.cover)); } catch { /* */ } }
            await writeIndex(list.filter((b) => b.id !== body.id));
            return json(res, 200, { ok: true });
          }
          if (req.method === 'GET' && path.startsWith('/dsh-bookshelf/api/cover/')) {
            const id = path.slice('/dsh-bookshelf/api/cover/'.length);
            const list = await readIndex();
            const book = list.find((b) => b.id === id);
            const file = book?.cover ? join(coversDir, book.cover) : null;
            if (!book?.cover || !existsSync(file)) {
              res.writeHead(404); res.end(); return;
            }
            const data = await readFile(file);
            res.writeHead(200, { 'content-type': book.cover.endsWith('.png') ? 'image/png' : 'image/jpeg' });
            res.end(data);
            return;
          }
          if (req.method === 'POST' && path === '/dsh-bookshelf/api/chat') {
            const body = await readBodyJson(req);
            const text = await runChat(ctx, body);
            return json(res, 200, { text });
          }
          return json(res, 404, { error: 'not found' });
        } catch (error) {
          return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    });
  });
}
