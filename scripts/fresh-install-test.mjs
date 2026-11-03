// Fresh-install smoke test: boots the REAL host module against a throwaway
// library root and asserts the complete first-run bootstrap a new user gets —
// AGENTS.md, index.json, covers, sample books with reading logs, workspace
// resolution, and idempotence on the second call.
//
// Usage: node scripts/fresh-install-test.mjs

import { rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.env.TMPDIR || '/tmp', 'dsh-bookshelf-fresh-test');
rmSync(root, { recursive: true, force: true });
process.env.DSH_BOOKSHELF_ROOT = root;

const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) failures.push(name);
};

// --- fake harness context: capture the HTTP route, stub the workspace
// registry with real memory semantics (list() remembers created workspaces)
let route = null;
const workspaces = [];
const createdWorkspaces = [];
const fakeCtx = {
  effect: (fn) => fn(),
  get: (key) => {
    if (key === 'webServer') {
      return { register: (r) => { route = r; return () => {}; } };
    }
    if (key === 'workspaceRegistry') {
      return {
        list: () => workspaces,
        create: (path, title) => {
          const w = { id: 'ws-test', path, title };
          workspaces.push(w);
          createdWorkspaces.push(w);
          return w;
        },
        delete: (id) => {
          const i = workspaces.findIndex((w) => w.id === id);
          if (i >= 0) workspaces.splice(i, 1);
        },
      };
    }
    return undefined;
  },
};

const { apply } = await import('../index.js');
apply(fakeCtx);
check('宿主 apply 注册了 /dsh-bookshelf/api 路由', route?.path === '/dsh-bookshelf/api');

// --- minimal node-style req/res
function call(method, urlPath) {
  return new Promise((resolveCall) => {
    const req = { method, url: urlPath };
    const res = {
      status: 0, body: '',
      writeHead(code) { this.status = code; },
      end(chunk) { this.body = String(chunk ?? ''); resolveCall(this); },
    };
    void route.handler(req, res);
  });
}

const first = await call('GET', '/dsh-bookshelf/api/books');
const firstBooks = JSON.parse(first.body || '[]');
check('首次 GET /books 返回 200', first.status === 200);
check(`自动导入 3 本样例书（实际 ${firstBooks.length} 本）`, firstBooks.length === 3);
check('样例含朝花夕拾/呐喊/红楼梦',
  ['朝花夕拾-鲁迅', '呐喊-鲁迅', '红楼梦-曹雪芹'].every((t) => firstBooks.some((b) => b.title === t)));

check('AGENTS.md 数据库手册已生成', existsSync(join(root, 'AGENTS.md'))
  && readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('dsh-bookshelf v1'));
check('index.json 书目已生成', existsSync(join(root, 'index.json')));
check('covers/ 封面目录已生成', existsSync(join(root, 'covers')));
check('.samples-imported 防重复标记已写入', existsSync(join(root, '.samples-imported')));

for (const title of ['朝花夕拾-鲁迅', '呐喊-鲁迅', '红楼梦-曹雪芹']) {
  const dir = join(root, title);
  const ok = existsSync(dir)
    && readdirSync(dir).some((f) => f.endsWith('.epub'))
    && existsSync(join(dir, 'reading-log.md'))
    && readFileSync(join(dir, 'reading-log.md'), 'utf8').includes('《');
  check(`《${title}》独立文件夹 + 原书 + reading-log 骨架`, ok);
}

check('「图书」工作区已自动创建（指向书库根）',
  createdWorkspaces.length === 1 && createdWorkspaces[0].title === '图书' && createdWorkspaces[0].path === root);

const ws = await call('GET', '/dsh-bookshelf/api/workspace');
check('GET /workspace 返回工作区 id', ws.status === 200 && JSON.parse(ws.body).id === 'ws-test');

// --- idempotence: second visit must not duplicate anything
const second = await call('GET', '/dsh-bookshelf/api/books');
const secondBooks = JSON.parse(second.body || '[]');
check('第二次 GET /books 不重复导入（幂等）', secondBooks.length === 3);
check('第二次访问不再新建工作区', createdWorkspaces.length === 1);

// --- cover endpoint for a sample book
const withCover = secondBooks.find((b) => b.cover);
if (withCover) {
  const cover = await call('GET', withCover.cover);
  check(`封面可访问（${withCover.title}，HTTP ${cover.status}）`, cover.status === 200);
} else {
  check('至少一本书带封面', false);
}

rmSync(root, { recursive: true, force: true });
console.log(failures.length === 0 ? '\n🎉 全新安装冒烟测试全部通过' : `\n💥 ${failures.length} 项失败: ${failures.join('、')}`);
process.exit(failures.length === 0 ? 0 : 1);
