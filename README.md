# 书架 · dsh-bookshelf

[DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh)（dsh）插件。
本地图书管理 + AI 领读：把书传进书架，点任意一本书，跳转到原生会话由「书架助手」带你读；
每本书的阅读进度与讨论记忆以 Markdown 数据库的形式长期保存在你自己的文件夹里。

## 装上以后有什么

- **书架页面**：侧栏多一个「书架」（书本图标）。支持上传 / 拖拽入库
  （epub · pdf · txt · md · mobi · azw3 · docx），epub 封面自动提取，书名 / 作者搜索。
- **开箱即有书**：首次使用自动赠送三本公版经典样例（《朝花夕拾》《呐喊》《红楼梦》），
  装完就能体验点书开读；不喜欢可直接删掉书库里的对应文件夹。
- **点书开读**：点击一本书，自动在「图书」工作区（首次打开书架时自动创建）开一个
  带「书架助手」预设的原生会话——助手会先读这本书的阅读日志恢复上次的进度和讨论，
  然后继续领读，可引用原文出处。
- **阅读记忆数据库**：书库就是 `~/Documents/图书/` 这个普通文件夹，
  每本书一个独立文件夹：

  ```
  ~/Documents/图书/
  ├── AGENTS.md            # 数据库手册（助手自动遵守）
  ├── index.json           # 书目
  └── 朝花夕拾/
      ├── 朝花夕拾.epub     # 原书（只读）
      ├── reading-log.md   # 阅读记忆：进度 / 读者画像 / 讨论记录 / 留给下次 / 金句
      └── notes/           # 笔记沉淀（金句摘抄、人物笔记……）
  ```

  全部是明文 Markdown，随时自己翻阅、修改；你手动改的日志，助手下次会照着执行。

## 安装

需要 dsh `0.2.1-rc.5` 及以上（更低版本未验证）。

### 在插件页面安装（推荐）

1. 侧栏打开「插件」，点「添加插件」。
2. 包名填 `dsh-bookshelf`，点安装；装完点「立即启用」。
3. 侧栏出现「书架」。

### 用命令行安装

```bash
dsh plugin --profile web add github:bqcldz/dsh-bookshelf   # 从 GitHub 装，跟着 main 最新提交
dsh plugin --profile web add dsh-bookshelf                 # npm 发布后可用
```

装完重启 / 刷新页面。

**升级**：在插件页面卸载再装一次（第三方插件目前的升级方式）。升级、卸载都不会动你的书库。
**PDF 说明**：pdf 格式可入库和显示封面，正文暂不支持提取，助手会基于自身知识回答并说明。

## 数据与隐私

- 书库在 `~/Documents/图书/`，是你可见、可备份的普通文件夹；卸载插件不会删除它。
- 记忆全部是本地明文 Markdown，没有任何隐藏数据库。
- 插件本身不联网上报数据；对话能力来自你 dsh 里配置的模型。

## 开发

```
index.js          宿主半边：HTTP API /dsh-bookshelf/api/*、入库与元数据提取、幂等迁移
client.js         客户端半边：侧栏图标 + 书架面板，点书跳转书架助手会话
cordis.patch.yml  插件行 + agent 预设 bookshelf（书架助手 persona）
```

开发循环：改代码 → `node --check` → 更新版本号与 `CHANGELOG.md` → git commit / tag →
宿主或 patch 有改动时在 dsh 里重装。详见 `CHANGELOG.md`。

## License

[MIT](./LICENSE)
