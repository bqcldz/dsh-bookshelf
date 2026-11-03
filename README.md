# dsh-bookshelf · 书架

DeepSeek Harness 本地图书管理插件：扫描/上传本地图书，在书架中选中一本书，
跳转到原生会话由「书架助手」领读；读书记忆以 Markdown 数据库形式持久化。

## 架构

- **书库**（用户数据，与本仓库分离）：`~/Documents/图书/`
  - `AGENTS.md` 数据库手册（会话自动加载）· `index.json` 书目 · `covers/`
  - `<书名>/`：原书 + `reading-log.md` 记忆表 + `notes/` 笔记
- **插件**（本仓库）：仅是书库的展示窗口
  - `index.js` 宿主半边：HTTP API `/dsh-bookshelf/api/*`（books/upload/import/
    remove/cover/workspace/chat）、入库与元数据提取（内置 zip 解析 epub/docx）、
    幂等迁移（ensureStructure / migrateLegacyLibrary / ensureBookWorkspace）
  - `client.js` 客户端半边：侧栏图标 + 书架整页面板，点书经
    `uiWorkspace.startSession` 跳转「图书」工作区的书架助手会话
  - `cordis.patch.yml`：插件行 + agent 预设 `bookshelf`（书架助手 persona）

## 开发循环

1. 改代码 → `node --check index.js && node --check client.js`
2. 版本号（package.json）与 `CHANGELOG.md` 同步更新
3. `git commit` + tag；宿主/patch 有改动需 `plugin_manager` remove+install
4. 冒烟：`curl <GUI>/dsh-bookshelf/api/books`

## 安装

```
plugin_manager install_bundle → /Users/qingcang/Documents/项目开发/dsh-bookshelf
```
