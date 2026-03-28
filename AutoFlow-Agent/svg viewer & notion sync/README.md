# SVG Viewer & Notion Sync

这个插件现在明确包含两部分能力：

1. 把 Markdown 里的 `svg` 和 `xml` 代码块渲染成响应式 SVG 预览。
2. 借助 Obsidian 社区插件 [Importer](https://obsidian.md/plugins?id=obsidian-importer) 的 `Notion (API)` 导入器，在 Obsidian 启动时或手动触发时，把 Notion 内容导入到按时间戳分组的文件夹中。

## SVG 预览

支持以下 fenced code block：

```md
```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#4f46e5" />
</svg>
```
```

也支持把同样内容写在 `xml` 代码块里。插件会自动：

- 清理危险标签与事件属性
- 自动补齐缺失的 `viewBox`
- 移除固定宽高，让 SVG 在笔记里自适应显示
- 用棋盘背景帮助识别透明区域

## Notion 自动同步

使用前请先确认：

1. 已安装并启用社区插件 `Importer`
2. 已在 Notion 创建 integration，并拿到 API token
3. 已在本插件设置页填写 `Notion API token`

插件行为：

1. 每次打开 Obsidian 时，可自动触发一次 Notion 导入
2. 每次导入都会在你设置的根目录下创建一个时间戳文件夹，例如 `Notion imports/run-20260324-103000`
3. 旧版本会自动清理，默认仅保留最新 5 份
4. 支持命令面板中的 `Sync Notion now`
5. 支持查看最近一次同步状态，以及复制最近一次同步目录路径

## 兼容性说明

插件 ID 现在是 `svg-viewer-notion-sync`。新的安装目录是：

```text
.obsidian/plugins/svg-viewer-notion-sync/
```

首次以新 ID 启动时，插件会尝试从旧目录 `.obsidian/plugins/svg-code-renderer/data.json` 自动迁移设置。

## 开发

```bash
npm install
npm run check
npm run build
```
 
## Vault Path

Current Obsidian vault config folder: `C:\sync\.obsidian`
Current Obsidian vault root: `C:\sync`
