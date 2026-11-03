# Changelog

本插件的所有显著变更都记录在此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循语义化版本（SemVer）。

## [0.3.0] - 2026-11-03

开箱即用：新用户首次打开书架即有可读之书、可见工作区。

### 新增
- 内置三本公版样例书（朝花夕拾 / 呐喊 / 红楼梦，随包分发）：全新书库首次
  使用时自动导入，即刻体验点书开读；`.samples-imported` 标记防止重复导入，
  用户删除样例后不会再次出现
- 首次打开书架页即自动创建「图书」工作区（原先在首次点书时才创建）
- 通用 `POST /api/workspace/ensure` 端点（按 title+path 找到或创建工作区）
- MIT LICENSE、用户手册式 README、package.json 发布字段（npm: dsh-bookshelf）

## [0.2.0] - 2026-11-03

架构定稿：插件成为「图书」工作区的展示窗口，书与记忆存入用户可见文件夹。

### 新增
- 记忆数据库（C 方案）：每本书独立文件夹 `<书名>/`，含原书 + `reading-log.md`
  （固定骨架：当前进度/读者画像/已读与讨论记录/留给下次/金句）+ `notes/` 笔记区
- `AGENTS.md` 书库操作手册（版本标记 `<!-- dsh-bookshelf v1 -->`，插件负责生成与升级），
  会话 cwd 自动加载
- agent 预设「书架助手 bookshelf」：先读日志恢复记忆 → 读原书 → 按手册协议合并更新日志
- 点书跳转：`uiWorkspace.startSession(图书工作区, {agentPreset:'bookshelf', prompt:恢复指令})`
- 「图书」专用工作区（首次访问自动创建）

### 变更
- 书库根目录从 `~/.dsh/plugin-data/dsh-bookshelf/library/` 迁移至
  `~/Documents/图书/`（用户可见项目文件夹；旧目录一次性 rename 迁移）
- 书架页移除右侧对话栏与删除按钮（对话统一走原生会话；删除仅允许手动管理文件）
- 面板改为固定深色配色（主题 token 在部分环境下对比度异常，可读性优先）

### 修复
- 宿主激活竞态：`export const inject = ['webServer', 'workspaceRegistry']`，
  避免冷启动时服务未就绪导致 HTTP 路由 404
- 点书跳转失败：改为与 dsh-guizang-design 相同的 `startSession` 模式
  （弃用 connectWorkspace + 手动草稿初始化）

## [0.1.0] - 2026-11-03

初版。

### 新增
- 书架整页面板：侧栏书本图标 + 封面网格 + 搜索 + 上传/拖拽入库
- 书籍入库（方案 A）：文件复制入库，支持 epub/pdf/txt/md/mobi/azw3/docx；
  epub 封面与正文提取（内置 zip 解析）、docx/txt/md 正文提取
- 内嵌式书架助手对话（后于 0.2.0 移除，改为原生会话跳转）
