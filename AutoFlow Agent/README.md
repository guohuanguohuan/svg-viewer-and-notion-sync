# AutoFlow Agent

<p align="center">
  <a href="https://github.com/guohuanguohuan/obsidian-plugin">Repository</a>
  |
  <a href="https://github.com/guohuanguohuan/obsidian-plugin/issues">Report Bug</a>
  |
  <a href="https://github.com/guohuanguohuan/obsidian-plugin/discussions">Discussions</a>
</p>

AutoFlow Agent is an Obsidian plugin for AI chat with note context, smart writing assistance, vault search, MCP integrations, and one-click edits. It is based on the Smart Composer codebase and keeps all contributor, development, configuration, and GitHub automation notes in this single README.

> [!NOTE]
> What's new in the current codebase:
>
> - `v1.2.8`: Connect your Gemini account
> - `v1.2.7`: Connect your Claude or OpenAI account directly without an API key
> - `v1.2.6`: Support for GPT-5.2, Opus 4.5, Gemini 3, and Grok 4.1
> - MCP support for external tools and data sources via the [Model Context Protocol](https://modelcontextprotocol.io)

> [!WARNING]
> Maintenance notice:
>
> - This plugin is currently maintained by a single developer and is not under active development.
> - Occasional updates or bug fixes may still be released, but issues and feature requests may not be reviewed promptly.
> - Community-maintained forks can be collected through GitHub Discussions if you want to share or discover alternative versions.

> [!WARNING]
> Risks of connecting a Claude subscription:
>
> - As of January 2026, Anthropic has restricted some third-party OAuth access and there have been public reports of Claude account restrictions when used through third-party clients.
> - For OpenAI and Google, there have not been comparable public ban reports seen in the original project notes, but this still differs from official API access and enforcement can change at any time.
> - Use subscription-based connections at your own risk, keep usage personal and interactive, and avoid automation.

![Title Demo](https://github.com/user-attachments/assets/a50a1f80-39ff-4eba-8090-e3d75e7be98c)

## Features

### Contextual chat

![Context Chat Demo](https://github.com/user-attachments/assets/8da4c189-399a-450a-9591-95f1c9af1bc8)

- Reference files and folders from your vault directly in chat
- Ask questions with note-aware context instead of pasting everything manually
- Use contextual responses inspired by Cursor-style AI workflows

### Multimedia context

<img src="https://github.com/user-attachments/assets/b22175d4-80a2-4122-8555-2b9dd4987f93" alt="Multimedia context" width="360" />

- Add website links and extract their content automatically
- Add images via upload, drag and drop, or clipboard paste
- Include YouTube transcript content as chat context
- Prepare for future support of external files such as PDF and DOCX

### Apply edit

![Apply Edit Demo](https://github.com/user-attachments/assets/35ee03ff-4a61-4d08-8032-ca61fb37dcf1)

- Generate document edits from AI output
- Review and apply suggested changes with one click

### Vault search (RAG)

![Vault Search Demo](https://github.com/user-attachments/assets/91c3ab8d-56d7-43b8-bb4a-1e73615a40ec)

- Search your vault semantically for relevant context
- Trigger Vault Search answers with `Cmd+Shift+Enter`

### MCP integration

![MCP Demo](https://github.com/user-attachments/assets/4c80a1af-4cbf-4aa4-90d2-457499553357)

- Connect external MCP servers
- Use third-party tools and data sources inside chat

### Additional capabilities

- Custom model selection for OpenAI, Anthropic, Gemini, Groq, DeepSeek, OpenRouter, Azure OpenAI, Ollama, LM Studio, MorphLLM, and other OpenAI-compatible providers
- Local model support through [Ollama](https://ollama.ai)
- Custom system prompts
- Prompt templates created from reusable slash commands or selected text

## Getting Started

> [!IMPORTANT]
> Installer requirement:
>
> AutoFlow Agent requires a recent Obsidian installer. If the plugin does not load properly:
>
> 1. Update Obsidian from `Settings > General > Check for updates`.
> 2. If that does not help, download the latest installer from [obsidian.md/download](https://obsidian.md/download), close Obsidian completely, and run the new installer.

1. Open Obsidian settings.
2. Go to Community plugins and click Browse.
3. Search for `AutoFlow Agent` and install it.
4. Enable the plugin.
5. Configure your preferred model access:
   - Connect a subscription in `Settings > AutoFlow Agent > Connect your subscription`
   - Or add API keys in `Settings > AutoFlow Agent > Providers`

> [!TIP]
> Gemini API is a strong free-tier option for many users. If you use free APIs, review each provider's privacy policy before sending sensitive vault content.

## Configuration Reference

Active plugin data path:

`C:\sync\.obsidian\plugins\autoflow-agent\data.json`

The plugin still stores runtime settings in one `data.json` file. The settings UI focuses on model JSON, but runtime behavior still depends on several top-level fields.

### Most commonly edited fields

- `chatModels`
- `chatModelId`
- `applyModelId`
- `embeddingModels`
- `embeddingModelId`
- `ragOptions`

### Fields to edit carefully

- `providers`
  The settings UI may no longer expose this section, but runtime still uses it. Do not delete it unless you also want to remove stored provider credentials and configuration.
- `version`
  Keep the existing value unless you are also changing migrations.
- `mcp`
- `chatOptions`
- `ragOptions`

### Minimal working `data.json`

```json
{
  "version": 16,
  "providers": [
    {
      "type": "openai",
      "id": "openai",
      "apiKey": "sk-..."
    },
    {
      "type": "gemini",
      "id": "gemini",
      "apiKey": "your-gemini-key"
    },
    {
      "type": "ollama",
      "id": "ollama"
    }
  ],
  "chatModels": [
    {
      "providerType": "openai",
      "providerId": "openai",
      "id": "gpt-5.2",
      "model": "gpt-5.2"
    },
    {
      "providerType": "openai",
      "providerId": "openai",
      "id": "gpt-4.1-mini",
      "model": "gpt-4.1-mini"
    },
    {
      "providerType": "gemini",
      "providerId": "gemini",
      "id": "gemini-3-pro-preview",
      "model": "gemini-3-pro-preview"
    }
  ],
  "embeddingModels": [
    {
      "providerType": "openai",
      "providerId": "openai",
      "id": "openai/text-embedding-3-small",
      "model": "text-embedding-3-small",
      "dimension": 1536
    }
  ],
  "chatModelId": "gpt-5.2",
  "applyModelId": "gpt-4.1-mini",
  "embeddingModelId": "openai/text-embedding-3-small",
  "systemPrompt": "",
  "ragOptions": {
    "chunkSize": 1000,
    "thresholdTokens": 8192,
    "minSimilarity": 0,
    "limit": 10,
    "excludePatterns": [],
    "includePatterns": []
  },
  "mcp": {
    "servers": []
  },
  "chatOptions": {
    "includeCurrentFileContent": true,
    "enableTools": true,
    "maxAutoIterations": 1
  }
}
```

### JSON blocks commonly edited in settings

#### Chat JSON

```json
{
  "chatModels": [
    {
      "providerType": "openai",
      "providerId": "openai",
      "id": "gpt-5.2",
      "model": "gpt-5.2"
    },
    {
      "providerType": "openai",
      "providerId": "openai",
      "id": "gpt-4.1-mini",
      "model": "gpt-4.1-mini"
    }
  ],
  "chatModelId": "gpt-5.2"
}
```

#### Apply JSON

```json
{
  "applyModelId": "gpt-4.1-mini"
}
```

#### Embedding JSON

```json
{
  "embeddingModels": [
    {
      "providerType": "openai",
      "providerId": "openai",
      "id": "openai/text-embedding-3-small",
      "model": "text-embedding-3-small",
      "dimension": 1536
    }
  ],
  "embeddingModelId": "openai/text-embedding-3-small",
  "ragOptions": {
    "chunkSize": 1000,
    "thresholdTokens": 8192,
    "minSimilarity": 0,
    "limit": 10,
    "excludePatterns": [],
    "includePatterns": []
  }
}
```

### Configuration rules

1. `chatModelId` must match one of the IDs in `chatModels`.
2. `applyModelId` must match one of the IDs in `chatModels`.
3. `embeddingModelId` must match one of the IDs in `embeddingModels`.
4. `ragOptions` controls indexing and retrieval behavior.
5. Every `providerId` used by a model must exist in `providers`.
6. IDs should remain unique inside each model array.

### Recommended setup

- Chat: `gpt-5.2` or `claude-sonnet-4.5`
- Apply: `gpt-4.1-mini`
- Embedding: `openai/text-embedding-3-small`

### Safe editing workflow

1. Back up `C:\sync\.obsidian\plugins\autoflow-agent\data.json`.
2. Edit the JSON sections in plugin settings, or edit `data.json` directly.
3. Reload the plugin in Obsidian.
4. If startup fails, restore the backup.

## Development Setup

### Local development workflow

1. Clone the repository into your Obsidian vault plugins directory.

   ```bash
   git clone https://github.com/guohuanguohuan/obsidian-plugin.git /path/to/your/vault/.obsidian/plugins/autoflow-agent
   ```

2. Enter the plugin directory.

   ```bash
   cd /path/to/your/vault/.obsidian/plugins/autoflow-agent/AutoFlow\ Agent
   ```

3. Install dependencies and start the dev build.

   ```bash
   npm install
   npm run dev
   ```

4. Test changes by reloading Obsidian manually or using the [Hot Reload plugin](https://github.com/pjeby/hot-reload).
5. If you need more build diagnostics, set `logLevel: debug` in `esbuild.config.mjs`.

### Validation commands

```bash
npm run build
npm run type:check
npm run lint:check
npm test
```

Use `npm run lint:fix` to auto-fix lint issues where possible.

## Database Development

This project uses PGlite and Drizzle ORM.

### Libraries

- [PGlite](https://pglite.dev/docs/) provides a lightweight PostgreSQL-compatible database runtime for JavaScript environments.
- [Drizzle ORM](https://orm.drizzle.team/docs/overview) provides type-safe schema and query support.

### Updating the schema

1. Edit `src/database/schema.ts`.
2. Generate migration files:

   ```bash
   npx drizzle-kit generate --name <migration-name>
   ```

3. Review the generated files in `drizzle/`.
4. Compile migrations into the JSON file used by runtime:

   ```bash
   npm run migrate:compile
   ```

This updates `src/database/migrations.json`. Migration files in `drizzle/` do not affect runtime until they are compiled into that JSON file.

### Squashing migration files

If you want a clean final migration after multiple schema edits:

1. Delete the newly generated migration files from `drizzle/`.
2. Delete the new snapshot files from `drizzle/meta/`.
3. Remove the new entries from `drizzle/meta/_journal.json`.
4. Run the generation command again to create one consolidated migration.

### Debugging the database in Obsidian

When debugging in the developer console:

1. Look for the message `Smart composer database initialized.`
2. Right-click the `DatabaseManager` object and choose `Store as global variable`.
3. Run queries through that stored object, for example:

```javascript
await temp1.pgClient.query(`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    AND table_type = 'BASE TABLE'
  ORDER BY table_schema, table_name;
`);
```

4. Call `await temp1.save()` if you need to persist changes to disk.

## Development Notes

### Course progress sync from Notion

The following progress summary is synchronized from the Notion course outline page on 2026-03-24 and captures the current plugin-specific implementation status and immediate next priorities.

#### Latest implementation progress

- The model settings UI was reshaped around three JSON editing blocks and related Chinese-first copy updates, reducing scattered configuration entry points.
- The old knowledge retrieval settings were merged into the model configuration flow, with the standalone RAG configuration area removed and only the vector database management entry retained during the transition period.
- A local embedding route was previously validated with `bge-small-zh-v1.5`, including local embedding generation, an OpenAI-compatible endpoint at `http://127.0.0.1:8787/v1`, automatic local service startup, and incremental vector index update experiments.
- After the 2026-03-24 architecture review, local embedding, local vector database, and local indexing services were explicitly dropped as the mainline direction in favor of Obsidian-search-based RAG.
- The unfinished work is no longer centered on fixing embedding connection tests. The active priority is to formalize the new search-based RAG architecture and continue second-stage feature delivery from that direction.
- `embeddingModels` has been removed from the active runtime path and current settings schema. Upgrades to `v17` remove `embeddingModels` and `embeddingModelId` through the `16 -> 17` migration.
- Search-based RAG is now the only primary retrieval path. The main flow is `Obsidian search -> result filtering -> read related paragraphs or heading blocks -> send sources to the model`.
- The test environment has been restored. After rebuilding dependency links with `CI=true corepack pnpm install --frozen-lockfile`, `npm test -- --runInBand` runs again and regression coverage has been restored.
- The database layer now includes cleanup migrations that remove historical `embeddings` and `vector_data_*` tables. The current schema has also been reduced to remove runtime-unused embedding table and type definitions.
- Historical settings migration compatibility has been strengthened so incomplete legacy configs no longer throw `TypeError` when reading nested `ollama*` or `openAICompatible*` fields.
- Migration test noise around embedding compatibility has been reduced. Remaining `embeddingModels` and `embeddingModelId` references are mostly limited to necessary compatibility layers.
- Based on the current implementation, the search-based RAG path should work on Android in principle because it depends on shared Obsidian APIs such as `vault.getMarkdownFiles()`, `vault.cachedRead()`, and `prepareSimpleSearch()`, rather than a desktop-only vector database workflow.
- The main Android risk is currently performance rather than compatibility. The implementation still reads matching Markdown files and performs in-memory matching, so very large vaults may cause more noticeable slowdown on mobile than on desktop.

#### Immediate next priorities

- Shift focus away from continued embedding cleanup and back to the main agent feature set.
- Continue the migration from the retired embedding-first path to the search-based RAG path before returning to the broader second-stage roadmap.
- Build out the execution backbone under `agent/`, including `runtime`, `skills registry`, `state machine`, `approval policy`, and `execution log`.
- Keep improving search-based RAG for Android by reducing full-vault reads, lowering one-shot concurrent reads, and using scope constraints and hit-file pruning earlier.
- Make the execution panel visible so users can inspect context reads, retrieval, generation, reflection, and approval states.
- Finish the diff preview, safe write-back, and rollback path so the plugin forms a complete demo-ready closed loop.
- Add web verification and broader regression coverage after the mainline feature set is stable.

### GitHub automation

The old local PowerShell and batch scripts have been replaced by an AI-friendly Markdown workflow. If you use an AI agent to perform GitHub pushes, follow the rules in the GitHub workflow section below instead of relying on local `.ps1` or `.bat` wrappers.

### PGlite in the Obsidian environment

PGlite typically uses `node:fs` to load bundle files, but Obsidian plugins run in a browser-like environment where `node:fs` is not available.

To work around that in `src/database/DatabaseManager.ts`:

1. Fetch the required PGlite resources manually.
2. Pass bundle files or URLs directly during database initialization.

In `esbuild.config.mjs`, `process` is defined as an empty object to prevent PGlite from detecting a Node environment:

```javascript
define: {
  process: '{}',
},
```

This works today, but it may affect libraries that rely on `process`, so keep an eye on future compatibility.

### ESM compatibility shim for PGlite

PGlite relies on ESM features such as `import.meta.url`, while this plugin build targets CommonJS for broader Obsidian compatibility.

The project uses `import-meta-url-shim.js` together with `esbuild.config.mjs`:

```javascript
define: {
  'import.meta.url': 'import_meta_url',
},
inject: [path.resolve('import-meta-url-shim.js')],
```

This bridges the gap between PGlite's ESM expectations and the CommonJS plugin bundle.

### Known issue: memory leak during plugin reloading

A memory leak has been observed when reloading the plugin repeatedly. This is more noticeable during development than normal end-user usage. If Obsidian becomes slow or unresponsive after many reloads, repeated plugin reloads may be the cause.

## Contributing

Contributions are welcome, including bug fixes, documentation improvements, and feature work.

For significant changes, discuss the idea first by opening an issue or starting a discussion. This reduces duplicate work and helps confirm the direction.

### Pull request checklist

1. Fork the repository and branch from `main`.
2. Run `npm install`.
3. Add tests for bug fixes or new behavior when appropriate.
4. Ensure `npm test` passes.
5. Ensure `npm run type:check` passes.
6. Ensure `npm run lint:check` passes.
7. Use `npm run lint:fix` if needed.

### Pull request review expectations

The core team monitors pull requests and may merge them, request changes, or close them with an explanation.

### License for contributions

This project is licensed under the [MIT License](LICENSE). By contributing, you agree that your contributions are licensed under the same terms.

## Deployment Notes

For maintainers with repository write access, releases can be created through Git tags:

```bash
git tag <version-number>
git push origin <version-number>
```

The GitHub workflow can then build, release, and create a pull request to bump versions in `versions.json`, `manifest.json`, and `package.json`. That pull request still needs manual review and merge.

## AI-Friendly GitHub Push Workflow

This repository now lives one level above this folder on GitHub, so the GitHub repository root contains the `AutoFlow Agent/` directory. The push workflow below is designed for AI agents or repeatable manual execution.

### Goal

Commit changes and push them to the GitHub repository remote.

### Mandatory auto-upload requirement

- Regardless of how the `.git` root directory changes in the future, every code run must end with an automatic GitHub upload attempt.
- Before uploading, always resolve the actual repository root dynamically with `git rev-parse --show-toplevel` instead of assuming the current folder is the Git root.
- After each code run completes, switch execution to the resolved Git root, then run the standard `git add -A`, commit, and push flow automatically.
- This rule applies even if the Git root moves above `AutoFlow Agent/`, back into `AutoFlow Agent/`, or to any other valid repository boundary.
- If the upload is blocked by authentication, network failure, or missing remote configuration, report the failure explicitly instead of silently skipping the upload.

### Runtime defaults

- Preferred tool: `git`
- Default branch: use the current branch when available, otherwise use `main`
- Default commit message: `auto update YYYY-MM-DD HH:mm:ss`
- Default remote URL: `https://github.com/guohuanguohuan/obsidian-plugin.git`

### Optional inputs

- `commit_message`
- `remote_url`
- `branch`

### Execution rules

1. Confirm Git is installed.
2. Confirm the current directory is inside a Git work tree.
3. Resolve the real Git root with `git rev-parse --show-toplevel` and run all subsequent Git commands from that root.
4. Initialize Git only if the directory is not already part of a repository.
5. Read the current branch name.
6. If `branch` is not provided, use the current branch or fall back to `main`.
7. Create the target branch if no branch exists yet.
8. If the current branch differs from the target branch, switch to the target branch with a reset-style checkout.
9. Check whether `origin` exists.
10. If `origin` does not exist:
   - Use the provided `remote_url`, or
   - Fall back to `https://github.com/guohuanguohuan/obsidian-plugin.git`, or
   - Stop and ask for a repository URL if neither is available.
11. After every code run completes, stage all changes with `git add -A`.
12. Check whether the staging area contains changes.
13. Create a commit only if staged changes exist.
14. If no new changes exist, skip the commit but still allow pushing existing history.
15. Push the target branch to `origin` and set the upstream.
16. Report whether the repository was initialized, which branch was used, whether a commit was created, and whether the push succeeded.

### Suggested commands

```bash
git --version
git rev-parse --is-inside-work-tree
git symbolic-ref --quiet --short HEAD
git remote
git remote get-url origin
git add -A
git diff --cached --quiet
git commit -m "<commit_message>"
git push -u origin <branch>
```

When needed, these commands may also be used:

```bash
git init
git checkout -b <branch>
git checkout -B <branch>
git remote add origin <remote_url>
```

### Stop conditions

Stop and report the blocker if:

- Git is not installed
- The directory is not writable
- No `origin`, no provided `remote_url`, and no usable default remote are available
- Push authentication is required but cannot be completed in the current environment

## Roadmap

Planned and desired improvements include:

- Support for external files such as PDF and DOCX
- Mentioning by tags or other metadata

## Feedback and Support

- Report bugs through [GitHub Issues](https://github.com/guohuanguohuan/obsidian-plugin/issues)
- Share feature requests and ideas through [GitHub Discussions](https://github.com/guohuanguohuan/obsidian-plugin/discussions)
- Share usage examples and workflows with the community

## Contributors

### Core team

These contributors were instrumental in shaping the original project vision, architecture, and design:

- [@glowingjade](https://github.com/glowingjade)
- [@kevin-on](https://github.com/kevin-on)
- [@realsnoopso](https://github.com/realsnoopso)
- [@woosukji](https://github.com/woosukji)

### Additional contributors

Thanks to everyone who has contributed improvements, fixes, ideas, and documentation over time.

## License

This project is licensed under the [MIT License](LICENSE).

## Support the Project

If you find the project useful and want to support original development:

<a href="https://www.buymeacoffee.com/kevin.on" target="_blank">
  <img src="https://github.com/user-attachments/assets/e794767d-b7dd-40eb-9132-e48ae7088000" alt="Buy Me A Coffee" width="180" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=glowingjade/obsidian-smart-composer&type=Date)](https://star-history.com/#glowingjade/obsidian-smart-composer&Date)
