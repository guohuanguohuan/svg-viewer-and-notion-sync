# SVG Viewer & Notion Sync

[![版本](https://img.shields.io/github/manifest-json/v/guohuanguohuan/svg-viewer-and-notion-sync?label=版本&color=blue)](https://github.com/guohuanguohuan/svg-viewer-and-notion-sync/blob/main/manifest.json) [![GitHub license](https://img.shields.io/github/license/guohuanguohuan/svg-viewer-and-notion-sync?label=许可证&color=green)](https://github.com/guohuanguohuan/svg-viewer-and-notion-sync/blob/main/LICENSE) [![最低版本](https://img.shields.io/badge/最低版本-v1.5.0+-purple)](https://github.com/guohuanguohuan/svg-viewer-and-notion-sync/blob/main/manifest.json)

本插件基于 Obsidian Importer 的 Notion API，旨在实现 Notion 页面与本地 Obsidian 的深度同步，并优化 SVG 代码块的预览体验。

## 📝 开发背景

这个插件是我在安卓端日常使用 Notion AI 之后自动将 Notion 内容同步到 Obsidian 用的。但是 Notion AI 太贵了，而且听说以后 Notion AI 会按量计费，所以打算自己做一个 Obsidian 插件来实现我自己想要的功能。

这个插件以后可能不用了，功能还蛮简单的，纯用 AI 完成的。各位如果发现不好用可以自行用 AI 改改。

## 🌟 核心功能

- **自动化同步**：利用 Notion API，将页面自动同步到 Obsidian 本地指定位置。
  - **多模式触发**：支持加载插件或启动 Obsidian 时自动同步，同时提供手动同步选项。
  - **灵活控制**：可随时开启或关闭自动同步功能。
- **版本管理**：默认保留最新的 **5 个版本**（保留数量可根据需求在设置中修改），确保数据安全。
- **SVG 修复与预览**：
  - 自动处理 Notion 导出的代码块标记（将两侧的多余反引号删除），实现 SVG 的行内预览。
  - **注意**：请在 Notion 中将内嵌 SVG 的代码块语言标签设置为 `xml`。

## ⚙️ 设置指南

### 如何获取 Notion API？
1. 进入 Notion 的 **设置与成员 (Settings & Members)**。
2. 选择 **连接 (Connections)** -> **开发或管理集成 (Develop or manage integrations)**（位于页面下方灰色小字）。
3. 选择 **内部集成 (Internal Integration)**。
4. 点击 **创建 (Create)** 以获取您的 API 密钥。

## 📥 安装方法

1. **前置需求**：请先安装官方的 **Obsidian Importer** 插件。
2. **创建目录**：在您的仓库路径 `.obsidian\plugins` 中创建名为 `svg-viewer-notion-sync` 的文件夹。
3. **部署文件**：下载并放入以下文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`

---

# English Documentation

This plugin is based on the Notion API of Obsidian Importer, aiming to achieve deep synchronization between Notion pages and local Obsidian, while optimizing the SVG code block preview experience.

## 📝 Background

I created this plugin to automatically sync Notion content to Obsidian after using Notion AI on Android daily. However, Notion AI is too expensive, and I heard that Notion AI will switch to usage-based pricing in the future, so I decided to make my own Obsidian plugin to implement the features I need.

I may not use this plugin in the future. The functionality is quite simple and was completed entirely with AI. If you find it doesn't work well for you, feel free to modify it with AI yourself.

## 🌟 Core Features

- **Automatic Sync**: Use Notion API to automatically sync pages to a specified location in Obsidian.
  - **Multiple Triggers**: Support automatic sync when loading the plugin or starting Obsidian, with manual sync option available.
  - **Flexible Control**: Enable or disable automatic sync at any time.
- **Version Management**: Keeps the latest **5 versions** by default (configurable in settings), ensuring data safety.
- **SVG Fix & Preview**:
  - Automatically handles Notion exported code block markers (removes extra backticks on both sides) for inline SVG preview.
  - **Note**: Please set the code block language tag to `xml` for embedded SVG in Notion.

## ⚙️ Setup Guide

### How to get Notion API?
1. Go to Notion **Settings & Members**.
2. Select **Connections** -> **Develop or manage integrations** (gray text at the bottom).
3. Select **Internal Integration**.
4. Click **Create** to get your API key.

## 📥 Installation

1. **Prerequisite**: Install the official **Obsidian Importer** plugin first.
2. **Create Directory**: Create a folder named `svg-viewer-notion-sync` in your vault path `.obsidian\plugins`.
3. **Deploy Files**: Download and place the following files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
