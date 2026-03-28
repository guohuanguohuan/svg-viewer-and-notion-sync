---
title: AutoFlow Agent
emoji: 💬
colorFrom: yellow
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
hf_oauth: true
---

这是一个部署在 Hugging Face Spaces 上的中文写作智能体原型，当前通过 Docker Space 托管一个纯后端 API，并通过兼容 OpenAI 接口的方式调用智谱 AI 的 `GLM-4.7-Flash` 模型。

当前 Space 地址：

- https://huggingface.co/spaces/yizhengjun/AutoFlow-Agent

## 项目目标

- 当前目标是先做出一个可公网访问、可受控访问的写作智能体原型
- 后续目标是让 Obsidian 插件接入这个 Space / 后端服务
- 当前阶段优先级是：先稳定部署、先保证访问安全、再逐步补齐智能体工程骨架

## 当前状态快照

这部分是给未来的自己和后续 AI 协作看的，帮助快速判断“现在做到哪一步了”。
每次运行结束后，都要把本次最新进展、当前可用状态、主要阻塞点和下一步建议同步更新到这一节，便于后续快速接手。

- 已完成 Hugging Face Space 创建与部署
- 已在 Space 中配置 `ZHIPU_API_KEY`
- 已在 Space 中配置 `ALLOWED_HF_USERNAMES`
- 当前版本已切换为 `sdk: docker`
- 当前后端已从 Gradio 改为 FastAPI 纯 API 服务
- 浏览器端仍保留最小 Hugging Face OAuth 登录能力
- 只有白名单中的 Hugging Face 用户名可以真正调用模型
- 当前 Obsidian 插件会直接请求后端 API
- 已新增独立的 Obsidian 插件骨架目录 `obsidian-plugin/`，其说明已并入本 README
- 2026-03-28 最新检查结果：仓库最新提交 SHA 已到 `a2e689c`，但 Hugging Face 运行时仍是 `RUNNING_BUILDING`
- 2026-03-28 最新检查结果：运行时 SHA 仍停留在旧值 `42c19278...`，说明新 Docker 版本还没有真正切到线上
- 2026-03-28 最新检查结果：`/health` 和 `/api/access-status` 线上还没有返回 FastAPI JSON，而是在返回旧的 Gradio 页面
- 2026-03-28 最新检查结果：Hugging Face 仓库元数据已经显示 `sdk: docker`，但线上首页和接口路径仍由旧 Gradio 应用响应
- 2026-03-28 最新检查结果：公开 runtime API 可访问，但日志接口未直接开放；`/logs/build` 用 Space JWT 会返回 401，`/logs/container` 返回 404，暂时无法直接拉到公开构建日志
- 当前可用状态：本地插件代码和本地后端改造已完成，但线上 Space 还没有完成切换，插件暂时不能依赖线上接口正常回复
- 当前主要阻塞点：Hugging Face Space 构建中，线上运行容器仍是旧版本
- 2026-03-28 当前策略调整：后续代码提交统一改为提交到 GitHub 私有仓库 `obsidian-plugin`
- 2026-03-28 当前策略调整：提交内容只保留 `C:\sync\syncall\1各种工具汇总\ai相关和rpomp\obsidian插件` 下的相对目录结构，不写入绝对路径
- 下一步建议：先在本地把 FastAPI 服务和 Obsidian 插件联调跑通，再回头处理 Hugging Face 线上部署

## 安全策略

应用不会把模型 API key 暴露给访问者，但如果 Space 公开且没有访问控制，别人仍然可以通过网页消耗你的 API 额度。

为避免这个问题，当前版本保留 Hugging Face 白名单校验：

- 在 `README` 中启用 `hf_oauth: true`
- 浏览器访问时可走 Hugging Face OAuth 登录
- 插件访问时可直接使用 Hugging Face access token
- 运行时统一校验 Hugging Face 用户名
- 只有 `ALLOWED_HF_USERNAMES` 环境变量中的用户名可访问模型

## 需要配置的环境变量

- `ZHIPU_API_KEY`
- `ALLOWED_HF_USERNAMES`

`ALLOWED_HF_USERNAMES` 使用英文逗号分隔多个用户名，例如：

```text
your-hf-username,user-two
```

说明：

- 真正生效的是 Hugging Face Space 设置中的环境变量值，不是 README 里的示例文字
- 不要把真实白名单用户名、token、API key 写进仓库
- 公开 Space 时，认证和白名单必须同时保留

## 当前能力

- 支持 Hugging Face 账号登录
- 支持基于白名单的访问控制
- 支持插件使用 Hugging Face token 直连后端 API
- 支持自定义系统提示词
- 支持调节 `max_tokens`、`temperature` 和 `top_p`

## 当前实现说明

- 后端：FastAPI
- 部署平台：Hugging Face Spaces
- Space 运行模式：Docker Space
- 模型调用方式：兼容 OpenAI 接口调用智谱 `GLM-4.7-Flash`
- 鉴权方式：Hugging Face OAuth 或 Hugging Face access token
- 访问控制方式：运行时校验 `ALLOWED_HF_USERNAMES`

当前应用还是“受保护的写作后端原型 + Obsidian 客户端”，还不是课程最终要求的完整写作智能体。

## 已知限制

- 目前后端仍是单文件应用，尚未拆分为 `api`、`auth`、`agent`、`writer` 等模块
- 目前没有 Reflection Loop
- 目前没有 Skill Registry
- 目前没有 Plan Mode
- 目前没有 diff 预览、写回确认、回滚
- 目前没有 artifacts 落盘
- 目前插件已能连后端，但写作能力还比较基础

## 下一步建议

如果以后让 AI 查看这个 README 并给出下一步，优先按下面顺序推进：

1. 先把当前单文件 `app.py` 拆分成最小模块结构
2. 增加第一个明确的写作 skill，例如 `polish-style`
3. 增加更稳定的 `/chat`、`/rewrite`、`/health` 接口约定
4. 增加 diff 预览和用户确认门，先不要自动写回
5. 增加最小 artifacts 输出，例如 `candidate.md` 和 `execution.json`
6. 再补 Reflection Loop

## 给后续 AI 的上下文提示

如果你是后续接手这个仓库的 AI，请先基于以下事实继续工作：

- 当前 Hugging Face Space 已经创建并部署成功
- 当前公开链接可访问，但真正调用模型需要 Hugging Face token 或浏览器登录 + 白名单校验
- 不要移除现有 OAuth 和白名单保护，除非用户明确要求
- 不要把真实的 API key、token、真实白名单用户名写入仓库
- 当前最值得做的是“把 API 原型升级为课程要求的写作智能体骨架”，而不是继续优化网页登录页
- 当前阶段代码提交目标为 GitHub 私有仓库 `obsidian-plugin`，不要再把“提交代码规则”写成提交到 Hugging Face Space
- 提交时只使用 `C:\sync\syncall\1各种工具汇总\ai相关和rpomp\obsidian插件` 目录下的相对路径，仓库中不要硬编码绝对 Windows 路径
- 无论 AI 最终是否提交到 GitHub，都必须明确告诉用户本次是否已提交，以及是否有必要这样做；在当前阶段默认应说明“未提交，正在优先处理本地联调，避免无关提交”
- 每次运行结束后，都必须回写 README 中的“当前状态快照”，至少更新这次做了什么、当前是否可用、还有哪些阻塞点，确保后续查看 README 就能快速接上进度

## 本地开发

本地运行时可先安装依赖：

```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 7860
```

如果需要本地调试 Docker Space，可参考 Hugging Face 官方文档：

- https://huggingface.co/docs/hub/spaces-sdks-docker
- https://huggingface.co/docs/hub/spaces-oauth

## Obsidian 插件骨架

`obsidian-plugin/` 是本项目的 Obsidian 插件开发骨架。本节是这个目录树的唯一说明，以后插件相关文档都优先更新这里。

### 当前范围

- 本地开发时作为标准社区插件加载
- 通过设置页配置服务连接信息
- 在 Obsidian 内显示简单状态
- 插件代码与仓库根部的后端原型隔离

### 文件清单

- `manifest.json`
- `src/main.ts`
- `styles.css`
- `package.json`
- `esbuild.config.mjs`
- `tsconfig.json`

### 本地开发

```bash
npm install
npm run build
```

构建完成后，把这个文件夹复制到你 vault 的 `.obsidian/plugins/auto-flow-agent/` 目录里做手动测试。

### 下一步建议

- 用真实服务调用替换占位命令
- 为后端契约补齐请求 / 响应类型
- 增加 diff 预览和写回确认流程
- 把插件设置连接到部署后的 backend 或独立服务

### 文档规则

- 当前文件夹及其所有子文件夹中，本项目自维护的 README 只保留这一份 `README.md`
- 其他子目录里的项目 README 都应并入这里，再删除掉
- 第三方依赖目录，例如 `node_modules`，不纳入这条规则
- 后续如果要补充文档，优先更新这一份 README，而不是在子目录新建 README
