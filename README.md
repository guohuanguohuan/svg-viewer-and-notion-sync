# SVG Viewer & Notion Sync

![版本](https://img.shields.io/badge/版本-v0.3.0-blue)
![许可证](https://img.shields.io/badge/许可证-MIT-green)
![最低版本](https://img.shields.io/badge/最低版本-v1.5.0+-purple)

利用 Notion API，将 Notion 的页面自动同步到 Obsidian 本地指定位置。每次重新加载插件或加载 Obsidian 都会自动同步（可配置）。由于同步的是 Obsidian Importer 导入的内容，本项目会自动处理 SVG 格式不兼容问题（主推配合 Notion 内嵌 SVG 转 xml 标语）。

---

---

## 🚀 核心功能
- **SVG 预览**：将 `svg` 和 `xml` 代码块直接渲染为自适应图形。
- **Notion 同步**：通过 [Importer](https://obsidian.md/plugins?id=obsidian-importer) 插件自动将 Notion 内容导入到带时间戳的本地文件夹。

---

## 🛠️ 工作原理

### 1. SVG 渲染机制
- **解析器**：使用 `DOMParser` 将源码解析为实时 SVG 元素。
- **格式纠错**：自动修复 Notion API 同步时常产生的 `xmlns="<url>"` 非法格式（剥离多余的 `< >` 符号），解决图形无法显示的问题。
- **安全性**：内置基于白名单的清理器，自动剥离危险标签（如 `<script>`）和事件处理器（如 `onclick`）。
- **响应式适配**：自动补齐 `viewBox` 并移除固定宽高，确保图形随笔记容器自适应缩放。
- **UI 优化**：添加棋盘背景，方便识别透明区域。

### 2. Notion 同步逻辑
- **插件桥接**：作为官方 **Importer** 插件的自动化层，通过编程方式调用其 `Notion (API)` 导入流程。
- **快照管理**：每次同步生成独立的 `run-YYYYMMDD-HHMMSS` 文件夹作为内容快照，默认保留**最近 5 个版本**，过旧的版本将自动清理以节省空间。

> [!NOTE]
> **性能说明**：受限于 Notion API 响应速度，同步过程可能需要 **1 分钟左右** 才能在 Obsidian 中看到文件变化，请耐心等待。

---

## 📖 快速配置

### 第一步：安装 Importer 插件
1. 打开 Obsidian 设置 (`Ctrl/Cmd + ,`)。
2. 进入 **社区插件** → **浏览**。
3. 搜索并安装 "**Importer**" 插件并启用。

### 第二步：获取 Notion API Token
1. 打开 Notion，点击右上角头像进入 **设置**。
2. 选择 **连接** → 点击底部的 **开发或管理集成**。
3. 点击 **+ 新建集成**，选择 **内部集成**，填写名称后提交。
4. 复制 **内部集成密钥** (Internal Integration Secret)，这就是你的 **API Token**。

### 第三步：将页面连接到集成
1. 进入你要同步的 Notion 页面。
2. 点击右上角 **...** → 选择 **连接** → **添加连接**。
3. 查找并选择你刚刚创建的集成名称。对所有需要同步的页面重复此操作。

> [!IMPORTANT]
> **必须手动连接页面，否则 API 无法访问它们。**

### 第四步：配置本插件
1. 在 Obsidian 插件设置中找到 "**SVG Viewer & Notion Sync**"。
2. 粘贴你的 **Notion API Token**。
3. 按需调整导入根目录或保留版本数。

### 第五步：开始同步
1. 按 `Ctrl/Cmd + P` 打开命令面板。
2. 搜索并运行：**立即同步 Notion**。

---

## ⚙️ 设置选项

| 设置项 | 说明 | 默认值 |
| :--- | :--- | :--- |
| **Notion API Token** | Notion 集成密钥 | - |
| **启动时自动同步** | 打开 Obsidian 时自动触发同步 | 开启 |
| **导入根目录** | 内容存储的根文件夹 | `Notion imports` |
| **保留版本数** | 自动清理前保留的快照数量 | 5 |

---

## 📦 安装方法

### 社区插件市场（推荐）
在 Obsidian 社区插件中搜索并安装 "**SVG Viewer & Notion Sync**"。

### 手动安装
1. 从 [Releases](https://github.com/guohuanguohuan/svg-viewer-and-notion-sync/releases) 下载 `main.js`、`manifest.json`、`styles.css`。
2. 在插件目录下创建文件夹：`<仓库>/.obsidian/plugins/svg-viewer-notion-sync/`。
3. 将下载的文件放入该文件夹并在 Obsidian 中启用。

---

## 💻 开发

```bash
npm install && npm run build
```

---

**许可证**: MIT
