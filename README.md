# SVG Viewer & Notion Sync

[中文文档](#中文文档) | [English Documentation](#english-documentation)

---

## English Documentation

An Obsidian plugin that provides two core capabilities:

1. **SVG Preview** - Render `svg` and `xml` code blocks as responsive inline SVG previews in your notes.
2. **Notion Sync** - Import Notion content into timestamped folders using the community plugin [Importer](https://obsidian.md/plugins?id=obsidian-importer).

---

### SVG Preview

Supports the following fenced code blocks:

```md
```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#4f46e5" />
</svg>
```
```

You can also use `xml` code blocks with the same content. The plugin automatically:

- **Sanitizes dangerous content** - Removes risky tags (`script`, `iframe`, `embed`, etc.) and event handlers (`onclick`, `onload`, etc.)
- **Auto-completes viewBox** - Automatically adds `viewBox` attribute if missing
- **Makes SVGs responsive** - Removes fixed width/height for adaptive display
- **Shows transparency** - Displays a checkerboard background to help identify transparent areas

---

### Notion Sync

#### Prerequisites

1. Install and enable the community plugin **Importer**
2. Create a Notion integration and obtain your API token
3. Configure your `Notion API Token` in the plugin settings

#### How to Get Notion API Token

1. Open Notion, go to **Settings** (click your profile picture)
2. Navigate to **Connections** → **Develop or manage integrations** (gray text at the bottom)
3. Click **New integration** or **+ Create new integration**
4. Select **Internal integration**
5. Fill in the integration name and submit
6. Copy the **Internal Integration Secret** (this is your API Token)
7. Go to the Notion pages you want to sync, click **...** → **Connections** → Add your integration

#### Features

| Feature | Description |
|---------|-------------|
| **Auto Sync on Startup** | Automatically triggers Notion import when Obsidian starts |
| **Timestamped Folders** | Each import creates a folder like `Notion imports/run-20260324-103000` |
| **Version Management** | Automatically cleans up old versions, keeping only the latest 5 |
| **Manual Sync** | Use command palette: `Sync Notion now` |
| **Sync Status** | View last sync status and copy sync folder path |

#### Commands

- `Sync Notion now` - Manually trigger a Notion sync
- `Show last Notion sync status` - Display the status of the last sync
- `Copy last Notion sync folder path` - Copy the path of the last sync folder to clipboard

#### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Notion API Token | Your Notion integration token | (empty) |
| Auto Sync on Startup | Enable automatic sync when Obsidian starts | Enabled |
| Import Base Folder | Root folder for Notion imports | `Notion imports` |
| Download External Attachments | Download attachments from external URLs | Disabled |
| Formula Strategy | How to handle Notion formulas | `hybrid` |
| Cover Property Name | Notion property name for cover images | `cover` |
| Database Property Name | Notion property name for database | `base` |

---

### Installation

#### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins → Browse
3. Search for "SVG Viewer & Notion Sync"
4. Click Install and Enable

#### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/guohuanguohuan/svg-viewer-and-notion-sync/releases)
2. Extract to your vault: `.obsidian/plugins/svg-viewer-notion-sync/`
3. Enable the plugin in Obsidian Settings → Community Plugins

---

### Compatibility

- **Plugin ID**: `svg-viewer-notion-sync`
- **Minimum Obsidian Version**: 1.5.0
- **Installation Path**: `.obsidian/plugins/svg-viewer-notion-sync/`

On first launch with the new ID, the plugin will attempt to migrate settings from the legacy directory `.obsidian/plugins/svg-code-renderer/data.json`.

---

### Development

```bash
# Install dependencies
npm install

# Type checking
npm run check

# Build
npm run build
```

---

## 中文文档

一个 Obsidian 插件，提供两项核心能力：

1. **SVG 预览** - 将 Markdown 中的 `svg` 和 `xml` 代码块渲染成响应式 SVG 预览。
2. **Notion 同步** - 借助社区插件 [Importer](https://obsidian.md/plugins?id=obsidian-importer) 的 Notion API 导入器，将 Notion 内容导入到按时间戳分组的文件夹中。

---

### SVG 预览

支持以下 fenced code block：

```md
```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#4f46e5" />
</svg>
```
```

也支持把同样内容写在 `xml` 代码块里。插件会自动：

- **清理危险内容** - 移除危险标签（`script`、`iframe`、`embed` 等）和事件处理器（`onclick`、`onload` 等）
- **自动补齐 viewBox** - 如果缺失则自动添加 `viewBox` 属性
- **响应式显示** - 移除固定宽高，让 SVG 在笔记中自适应显示
- **透明区域识别** - 用棋盘背景帮助识别透明区域

---

### Notion 同步

#### 使用前准备

1. 安装并启用社区插件 **Importer**
2. 创建 Notion 集成并获取 API Token
3. 在本插件设置页填写 `Notion API Token`

#### 如何获取 Notion API Token

1. 打开 Notion，点击右上角头像进入 **设置**
2. 进入 **连接** → **开发或管理集成**（最下方灰色字）
3. 点击 **创建集成** 或 **+ 新建集成**
4. 选择 **内部集成**
5. 填写集成名称并提交
6. 复制 **内部集成密钥**（这就是你的 API Token）
7. 进入要同步的 Notion 页面，点击 **...** → **连接** → 添加你创建的集成

#### 功能特性

| 功能 | 说明 |
|------|------|
| **启动时自动同步** | 打开 Obsidian 时自动触发 Notion 导入 |
| **时间戳文件夹** | 每次导入创建如 `Notion imports/run-20260324-103000` 的文件夹 |
| **版本管理** | 自动清理旧版本，默认仅保留最新 5 份 |
| **手动同步** | 使用命令面板：`立即同步 Notion` |
| **同步状态** | 查看最近同步状态，复制同步目录路径 |

#### 命令列表

- `立即同步 Notion` - 手动触发 Notion 同步
- `显示上次 Notion 同步状态` - 显示上次同步的状态信息
- `复制上次 Notion 同步目录路径` - 将上次同步的文件夹路径复制到剪贴板

#### 设置选项

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| Notion API Token | Notion 集成令牌 | （空） |
| 启动时自动同步 | 打开 Obsidian 时自动同步 | 开启 |
| 导入根目录 | Notion 导入的根文件夹 | `Notion imports` |
| 下载外部附件 | 从外部 URL 下载附件 | 关闭 |
| 公式策略 | 处理 Notion 公式的方式 | `hybrid` |
| 封面属性名 | 封面图片的 Notion 属性名 | `cover` |
| 数据库属性名 | 数据库的 Notion 属性名 | `base` |

---

### 安装方法

#### 通过社区插件市场安装（推荐）

1. 打开 Obsidian 设置
2. 进入社区插件 → 浏览
3. 搜索 "SVG Viewer & Notion Sync"
4. 点击安装并启用

#### 手动安装

1. 从 [GitHub Releases](https://github.com/guohuanguohuan/svg-viewer-and-notion-sync/releases) 下载最新版本
2. 解压到你的仓库：`.obsidian/plugins/svg-viewer-notion-sync/`
3. 在 Obsidian 设置 → 社区插件中启用该插件

---

### 兼容性说明

- **插件 ID**：`svg-viewer-notion-sync`
- **最低 Obsidian 版本**：1.5.0
- **安装目录**：`.obsidian/plugins/svg-viewer-notion-sync/`

首次以新 ID 启动时，插件会尝试从旧目录 `.obsidian/plugins/svg-code-renderer/data.json` 自动迁移设置。

---

### 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run check

# 构建
npm run build
```

---

## License

MIT License
