import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	normalizePath,
} from "obsidian";

const BLOCKED_TAG_NAMES = new Set([
	"audio",
	"canvas",
	"embed",
	"foreignobject",
	"iframe",
	"object",
	"script",
	"style",
	"video",
]);

const IMPORTER_PLUGIN_ID = "obsidian-importer";
const IMPORTER_FORMAT_ID = "notion-api";
const LEGACY_PLUGIN_ID = "svg-code-renderer";
const CURRENT_PLUGIN_ID = "svg-viewer-notion-sync";
const DEFAULT_IMPORT_ROOT = "Notion imports";
const SUPPORTED_SVG_CODE_BLOCKS = ["svg", "xml"] as const;
const VERSION_FOLDER_PREFIX = "run-";
const VERSION_FOLDER_PATTERN = /^run-\d{8}-\d{6}(?:-\d+)?$/;

type FormulaImportStrategy = "hybrid" | "static";
type SyncStatus = "idle" | "success" | "failed" | "skipped";
type SyncTrigger = "startup" | "manual";

interface SvgCodeRendererSettings {
	notionApiToken: string;
	notionImportBaseFolder: string;
	autoSyncOnStartup: boolean;
	downloadExternalAttachments: boolean;
	singleLineBreaks: boolean;
	formulaStrategy: FormulaImportStrategy;
	coverPropertyName: string;
	databasePropertyName: string;
	maxSyncVersions: number;
	lastSyncStatus: SyncStatus;
	lastSyncMessage: string;
	lastSyncFolder: string;
	lastSyncStartedAt: string;
	lastSyncFinishedAt: string;
}

const DEFAULT_SETTINGS: SvgCodeRendererSettings = {
	notionApiToken: "",
	notionImportBaseFolder: DEFAULT_IMPORT_ROOT,
	autoSyncOnStartup: true,
	downloadExternalAttachments: false,
	singleLineBreaks: false,
	formulaStrategy: "hybrid",
	coverPropertyName: "cover",
	databasePropertyName: "base",
	maxSyncVersions: 5,
	lastSyncStatus: "idle",
	lastSyncMessage: "尚未执行过 Notion 同步。",
	lastSyncFolder: "",
	lastSyncStartedAt: "",
	lastSyncFinishedAt: "",
};

interface ButtonStubLike {
	buttonEl: HTMLButtonElement;
	setButtonText(text: string): ButtonStubLike;
	setDisabled(disabled: boolean): ButtonStubLike;
}

interface ImporterModalLike {
	contentEl: HTMLElement;
	plugin: ImporterPluginLike;
}

interface ImporterDefinitionLike {
	importer: new (app: unknown, modal: ImporterModalLike) => NotionApiImporterLike;
}

interface ImporterPluginLike {
	importers?: Record<string, ImporterDefinitionLike>;
	registerAuthCallback(callback: (data: unknown) => void): void;
}

interface NotionTreeNodeLike {
	id: string;
	type: "page" | "database";
	children: NotionTreeNodeLike[];
	selected: boolean;
	disabled: boolean;
}

interface ImportContextLike {
	notes: number;
	attachments: number;
	skipped: string[];
	failed: string[];
	statusMessage: string;
	cancelled: boolean;
	status(message: string): void;
	reportProgress(current: number, total: number): void;
	reportNoteSuccess(name: string): void;
	reportAttachmentSuccess(name: string): void;
	reportSkipped(name: string, reason?: unknown): void;
	reportFailed(name: string, reason?: unknown): void;
	hideStatus(): void;
	cancel(): void;
	isCancelled(): boolean;
}

interface NotionApiImporterLike {
	notionToken: string;
	outputLocation: string;
	formulaStrategy: FormulaImportStrategy;
	downloadExternalAttachments: boolean;
	singleLineBreaks: boolean;
	coverPropertyName: string;
	databasePropertyName: string;
	import(ctx: ImportContextLike): Promise<void>;
	["incrementalImport"]?: boolean;
	["listPagesButton"]?: ButtonStubLike;
	["toggleSelectButton"]?: ButtonStubLike;
	["pageTree"]?: NotionTreeNodeLike[];
	["loadPageTree"]?: () => Promise<void>;
	["selectAllNodes"]?: (selected: boolean) => void;
}

interface ImportedFileStats {
	totalFiles: number;
	notes: number;
	databases: number;
	attachments: number;
}

class SyncImportContext implements ImportContextLike {
	notes = 0;
	attachments = 0;
	skipped: string[] = [];
	failed: string[] = [];
	statusMessage = "";
	cancelled = false;

	status(message: string): void {
		this.statusMessage = message;
	}

	reportProgress(_current: number, _total: number): void {}

	reportNoteSuccess(_name: string): void {
		this.notes++;
	}

	reportAttachmentSuccess(_name: string): void {
		this.attachments++;
	}

	reportSkipped(name: string, reason?: unknown): void {
		this.skipped.push(this.formatEntry(name, reason));
	}

	reportFailed(name: string, reason?: unknown): void {
		this.failed.push(this.formatEntry(name, reason));
	}

	hideStatus(): void {}

	cancel(): void {
		this.cancelled = true;
	}

	isCancelled(): boolean {
		return this.cancelled;
	}

	private formatEntry(name: string, reason?: unknown): string {
		return reason ? `${name}: ${String(reason)}` : name;
	}
}

export default class SvgCodeRendererPlugin extends Plugin {
	settings: SvgCodeRendererSettings = DEFAULT_SETTINGS;

	private syncInProgress = false;
	private startupSyncHandled = false;

	async onload(): Promise<void> {
		await this.migrateLegacyPluginData();
		await this.loadSettings();

		for (const language of SUPPORTED_SVG_CODE_BLOCKS) {
			this.registerMarkdownCodeBlockProcessor(language, (source, el) => {
				this.renderSvgBlock(source, el);
			});
		}

		this.addCommand({
			id: "sync-notion-now",
			name: "立即同步 Notion",
			callback: () => {
				void this.runNotionSync("manual");
			},
		});

		this.addCommand({
			id: "show-last-notion-sync-status",
			name: "显示上次 Notion 同步状态",
			callback: () => {
				new Notice(this.getLastSyncSummary());
			},
		});

		this.addCommand({
			id: "copy-last-notion-sync-folder",
			name: "复制上次 Notion 同步目录路径",
			callback: () => {
				void this.copyLastSyncFolderPath();
			},
		});

		this.addSettingTab(new SvgCodeRendererSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			void this.handleStartupSync();
		});
	}

	async loadSettings(): Promise<void> {
		const loadedSettings = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
		this.settings.notionImportBaseFolder = this.getBaseImportFolder();
		this.settings.coverPropertyName = this.readTrimmedValue(
			this.settings.coverPropertyName,
			DEFAULT_SETTINGS.coverPropertyName,
		);
		this.settings.databasePropertyName = this.readTrimmedValue(
			this.settings.databasePropertyName,
			DEFAULT_SETTINGS.databasePropertyName,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async migrateLegacyPluginData(): Promise<void> {
		if (this.manifest.id !== CURRENT_PLUGIN_ID) {
			return;
		}

		const adapter = this.app.vault.adapter;
		const configDir = this.app.vault.configDir;
		const currentDataPath = normalizePath(`${configDir}/plugins/${CURRENT_PLUGIN_ID}/data.json`);
		const legacyDataPath = normalizePath(`${configDir}/plugins/${LEGACY_PLUGIN_ID}/data.json`);

		try {
			if (await adapter.exists(currentDataPath)) {
				return;
			}

			if (!(await adapter.exists(legacyDataPath))) {
				return;
			}

			const legacyData = await adapter.read(legacyDataPath);
			await this.saveData(JSON.parse(legacyData));
			new Notice(`已将设置从 "${LEGACY_PLUGIN_ID}" 迁移到 "${CURRENT_PLUGIN_ID}"。`);
		} catch (error) {
			console.error("Failed to migrate legacy plugin data", error);
			new Notice(
				`无法从 "${LEGACY_PLUGIN_ID}" 迁移设置：${this.getErrorMessage(error)}`,
			);
		}
	}

	async runNotionSync(trigger: SyncTrigger): Promise<void> {
		if (this.syncInProgress) {
			if (trigger === "manual") {
				new Notice("Notion 同步已在进行中。");
			}
			return;
		}

		const token = this.settings.notionApiToken.trim();
		if (!token) {
			await this.updateSyncState(
				"skipped",
				"由于尚未配置 API Token，已跳过 Notion 同步。",
				"",
			);
			if (trigger === "manual") {
				new Notice("请先在插件设置中填写 Notion API Token。");
			}
			return;
		}

		const importerPlugin = this.getImporterPlugin();
		if (!importerPlugin) {
			const message = 'Notion 同步依赖社区插件 “Importer”，请先安装并启用它。';
			await this.updateSyncState("failed", message, "");
			new Notice(message);
			return;
		}

		const importerDefinition = importerPlugin.importers?.[IMPORTER_FORMAT_ID];
		if (!importerDefinition) {
			const message = 'Importer 插件没有暴露 “Notion (API)” 导入器。';
			await this.updateSyncState("failed", message, "");
			new Notice(message);
			return;
		}

		this.syncInProgress = true;
		const startedAt = new Date().toISOString();
		let versionFolderPath = "";

		try {
			versionFolderPath = await this.createVersionFolder();

			const importer = this.createNotionImporter(
				importerPlugin,
				importerDefinition.importer,
				versionFolderPath,
				token,
			);

			await this.prepareImporter(importer);

			if (trigger === "manual") {
				new Notice(`正在同步 Notion 到 "${versionFolderPath}"...`);
			}

			const ctx = new SyncImportContext();
			await importer.import(ctx);
			await this.cleanupOldVersionFolders();

			const syncStatus: SyncStatus = ctx.failed.length > 0 ? "failed" : "success";
			const importedFileStats = this.collectImportedFileStats(versionFolderPath);
			const message = this.buildSyncSummary(versionFolderPath, ctx, importedFileStats);

			await this.updateSyncState(syncStatus, message, versionFolderPath, startedAt);
			new Notice(message);
		} catch (error) {
			const removedEmptyFolder = await this.cleanupEmptyVersionFolder(versionFolderPath);
			if (removedEmptyFolder) {
				versionFolderPath = "";
			}
			await this.cleanupOldVersionFolders();
			const message = `Notion 同步失败：${this.getErrorMessage(error)}`;
			await this.updateSyncState("failed", message, versionFolderPath, startedAt);
			new Notice(message);
		} finally {
			this.syncInProgress = false;
		}
	}

	getLastSyncSummary(): string {
		const parts: string[] = [
			`状态：${this.describeSyncStatus(this.settings.lastSyncStatus)}。`,
			this.settings.lastSyncMessage,
		];

		if (this.settings.lastSyncFinishedAt) {
			parts.push(`上次完成时间：${this.formatTimestampForDisplay(this.settings.lastSyncFinishedAt)}。`);
		}

		if (this.settings.lastSyncFolder) {
			parts.push(`最近同步目录：${this.settings.lastSyncFolder}。`);
		}

		return parts.join(" ");
	}

	private async handleStartupSync(): Promise<void> {
		if (this.startupSyncHandled) {
			return;
		}

		this.startupSyncHandled = true;
		if (!this.settings.autoSyncOnStartup) {
			return;
		}

		await this.runNotionSync("startup");
	}

	private renderSvgBlock(source: string, containerEl: HTMLElement): void {
		containerEl.empty();
		containerEl.addClass("svg-code-renderer");

		const parsedSvg = this.parseSvg(source);
		if (!parsedSvg) {
			this.renderError(
				containerEl,
				"Unable to render this block as SVG. Use a fenced `svg` or `xml` code block with a valid <svg> root element.",
				source,
			);
			return;
		}

		const sanitizedSvg = this.sanitizeSvg(parsedSvg);
		this.makeSvgResponsive(sanitizedSvg);
		sanitizedSvg.addClass("svg-code-renderer__svg");

		if (!sanitizedSvg.getAttribute("role")) {
			sanitizedSvg.setAttribute("role", "img");
		}

		if (!sanitizedSvg.getAttribute("aria-label")) {
			sanitizedSvg.setAttribute("aria-label", "SVG preview");
		}

		containerEl.appendChild(sanitizedSvg);
	}

	private parseSvg(source: string): Element | null {
		const normalizedSource = this.normalizeSvgSource(source);
		const parser = new DOMParser();
		const documentNode = parser.parseFromString(normalizedSource.trim(), "image/svg+xml");
		const rootNode = documentNode.documentElement;

		if (documentNode.getElementsByTagName("parsererror").length > 0) {
			return null;
		}

		if (rootNode.tagName.toLowerCase() !== "svg") {
			return null;
		}

		const importedNode = rootNode.cloneNode(true);
		if (!(importedNode instanceof Element)) {
			return null;
		}

		if (!importedNode.getAttribute("xmlns")) {
			importedNode.setAttribute("xmlns", "http://www.w3.org/2000/svg");
		}

		return importedNode;
	}

	private normalizeSvgSource(source: string): string {
		return source
			.replace(/xmlns\s*=\s*"<([^">]+)>"/g, 'xmlns="$1"')
			.replace(/xmlns\s*=\s*'<([^'>]+)>'/g, 'xmlns="$1"')
			.replace(/xmlns:xlink\s*=\s*"<([^">]+)>"/g, 'xmlns:xlink="$1"')
			.replace(/xmlns:xlink\s*=\s*'<([^'>]+)>'/g, 'xmlns:xlink="$1"');
	}

	private sanitizeSvg(rootSvg: Element): Element {
		const queue: Element[] = [rootSvg];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				continue;
			}

			const children = Array.from(current.children);
			for (const child of children) {
				const tagName = child.tagName.toLowerCase();
				if (BLOCKED_TAG_NAMES.has(tagName)) {
					child.remove();
					continue;
				}

				this.removeDangerousAttributes(child);
				queue.push(child);
			}

			this.removeDangerousAttributes(current);
		}

		return rootSvg;
	}

	private makeSvgResponsive(rootSvg: Element): void {
		const width = this.readLengthValue(rootSvg.getAttribute("width"));
		const height = this.readLengthValue(rootSvg.getAttribute("height"));

		if (!rootSvg.getAttribute("viewBox") && width !== null && height !== null) {
			rootSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		}

		rootSvg.removeAttribute("width");
		rootSvg.removeAttribute("height");

		if (!rootSvg.getAttribute("preserveAspectRatio")) {
			rootSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
		}
	}

	private readLengthValue(value: string | null): number | null {
		if (!value) {
			return null;
		}

		const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
		if (!match) {
			return null;
		}

		const parsedValue = Number(match[1]);
		return Number.isFinite(parsedValue) ? parsedValue : null;
	}

	private removeDangerousAttributes(element: Element): void {
		const attributes = Array.from(element.attributes);

		for (const attribute of attributes) {
			const name = attribute.name.toLowerCase();
			const value = attribute.value.trim().toLowerCase();

			if (name.startsWith("on")) {
				element.removeAttribute(attribute.name);
				continue;
			}

			if ((name === "href" || name.endsWith(":href")) && value.startsWith("javascript:")) {
				element.removeAttribute(attribute.name);
				continue;
			}

			if (name === "style" && value.includes("javascript:")) {
				element.removeAttribute(attribute.name);
			}
		}
	}

	private renderError(containerEl: HTMLElement, message: string, source: string): void {
		const errorEl = containerEl.createDiv({ cls: "svg-code-renderer__error" });
		errorEl.setText(message);

		const sourceWrapperEl = containerEl.createDiv({ cls: "svg-code-renderer__source" });
		const preEl = sourceWrapperEl.createEl("pre");
		preEl.createEl("code", { text: source });
	}

	private getImporterPlugin(): ImporterPluginLike | null {
		const pluginRegistry = (
			this.app as typeof this.app & {
				plugins?: { plugins?: Record<string, unknown> };
			}
		).plugins;

		const importerPlugin = pluginRegistry?.plugins?.[IMPORTER_PLUGIN_ID];
		return importerPlugin ? (importerPlugin as ImporterPluginLike) : null;
	}

	private createNotionImporter(
		importerPlugin: ImporterPluginLike,
		ImporterClass: new (app: unknown, modal: ImporterModalLike) => NotionApiImporterLike,
		outputLocation: string,
		token: string,
	): NotionApiImporterLike {
		const modalStub: ImporterModalLike = {
			contentEl: createDiv(),
			plugin: importerPlugin,
		};

		const importer = new ImporterClass(this.app, modalStub);
		importer.notionToken = token;
		importer.outputLocation = outputLocation;
		importer.formulaStrategy = this.settings.formulaStrategy;
		importer.downloadExternalAttachments = this.settings.downloadExternalAttachments;
		importer.singleLineBreaks = this.settings.singleLineBreaks;
		importer.coverPropertyName = this.readTrimmedValue(
			this.settings.coverPropertyName,
			DEFAULT_SETTINGS.coverPropertyName,
		);
		importer.databasePropertyName = this.readTrimmedValue(
			this.settings.databasePropertyName,
			DEFAULT_SETTINGS.databasePropertyName,
		);
		importer.incrementalImport = false;
		importer.listPagesButton = this.createButtonStub();
		importer.toggleSelectButton = this.createButtonStub();
		return importer;
	}

	private async prepareImporter(importer: NotionApiImporterLike): Promise<void> {
		const loadPageTree = importer.loadPageTree;
		const selectAllNodes = importer.selectAllNodes;

		if (typeof loadPageTree !== "function" || typeof selectAllNodes !== "function") {
			throw new Error("Importer 插件的 API 已发生变化，当前桥接方式已不再安全可用。");
		}

		await loadPageTree.call(importer);

		const pageTree = importer.pageTree;
		if (!pageTree || pageTree.length === 0) {
			throw new Error("没有可导入的 Notion 页面或数据库。");
		}

		selectAllNodes.call(importer, true);

		if (!this.hasSelectedNode(pageTree)) {
			throw new Error("没有选中任何可导入的 Notion 页面或数据库。");
		}
	}

	private hasSelectedNode(nodes: NotionTreeNodeLike[]): boolean {
		for (const node of nodes) {
			if (node.selected) {
				return true;
			}

			if (this.hasSelectedNode(node.children)) {
				return true;
			}
		}

		return false;
	}

	private createButtonStub(): ButtonStubLike {
		const buttonEl = createEl("button");
		const stub: ButtonStubLike = {
			buttonEl,
			setButtonText(text: string): ButtonStubLike {
				buttonEl.setText(text);
				return stub;
			},
			setDisabled(disabled: boolean): ButtonStubLike {
				buttonEl.disabled = disabled;
				return stub;
			},
		};

		return stub;
	}

	private async createVersionFolder(): Promise<string> {
		const baseFolderPath = this.getBaseImportFolder();
		await this.ensureFolderPath(baseFolderPath);

		const versionBaseName = `${VERSION_FOLDER_PREFIX}${this.formatVersionTimestamp(new Date())}`;
		let versionFolderPath = normalizePath(`${baseFolderPath}/${versionBaseName}`);
		let suffix = 1;

		while (this.app.vault.getAbstractFileByPath(versionFolderPath)) {
			versionFolderPath = normalizePath(`${baseFolderPath}/${versionBaseName}-${suffix}`);
			suffix++;
		}

		await this.ensureFolderPath(versionFolderPath);
		return versionFolderPath;
	}

	private async ensureFolderPath(folderPath: string): Promise<TFolder> {
		const normalizedPath = normalizePath(folderPath);
		const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (existing instanceof TFolder) {
			return existing;
		}

		if (existing) {
			throw new Error(`"${normalizedPath}" already exists as a file.`);
		}

		let currentPath = "";
		let currentFolder = this.app.vault.getRoot();

		for (const segment of normalizedPath.split("/").filter(Boolean)) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			const currentEntry = this.app.vault.getAbstractFileByPath(currentPath);

			if (currentEntry instanceof TFolder) {
				currentFolder = currentEntry;
				continue;
			}

			if (currentEntry) {
				throw new Error(`"${currentPath}" already exists as a file.`);
			}

			currentFolder = await this.app.vault.createFolder(currentPath);
		}

		return currentFolder;
	}

	private async cleanupOldVersionFolders(): Promise<void> {
		const baseFolder = this.app.vault.getAbstractFileByPath(this.getBaseImportFolder());
		if (!(baseFolder instanceof TFolder)) {
			return;
		}

		const versionFolders = baseFolder.children
			.filter((child): child is TFolder => child instanceof TFolder && VERSION_FOLDER_PATTERN.test(child.name))
			.sort((left, right) => right.name.localeCompare(left.name));

		for (const folder of versionFolders.slice(this.settings.maxSyncVersions)) {
			await this.app.vault.trash(folder, false);
		}
	}

	private async cleanupEmptyVersionFolder(versionFolderPath: string): Promise<boolean> {
		if (!versionFolderPath) {
			return false;
		}

		const folder = this.app.vault.getAbstractFileByPath(versionFolderPath);
		if (!(folder instanceof TFolder) || folder.children.length > 0) {
			return false;
		}

		await this.app.vault.trash(folder, false);
		return true;
	}

	private collectImportedFileStats(versionFolderPath: string): ImportedFileStats {
		const stats: ImportedFileStats = {
			totalFiles: 0,
			notes: 0,
			databases: 0,
			attachments: 0,
		};
		const rootFolder = this.app.vault.getAbstractFileByPath(versionFolderPath);

		if (!(rootFolder instanceof TFolder)) {
			return stats;
		}

		const queue: TFolder[] = [rootFolder];
		while (queue.length > 0) {
			const currentFolder = queue.shift();
			if (!currentFolder) {
				continue;
			}

			for (const child of currentFolder.children) {
				if (child instanceof TFolder) {
					queue.push(child);
					continue;
				}

				if (!(child instanceof TFile)) {
					continue;
				}

				stats.totalFiles++;
				const extension = child.extension.toLowerCase();

				if (extension === "md") {
					stats.notes++;
				} else if (extension === "base") {
					stats.databases++;
				} else {
					stats.attachments++;
				}
			}
		}

		return stats;
	}

	private buildSyncSummary(
		versionFolderPath: string,
		ctx: SyncImportContext,
		importedFileStats: ImportedFileStats,
	): string {
		const importedNotes = importedFileStats.notes > 0 ? importedFileStats.notes : ctx.notes;
		const importedAttachments =
			importedFileStats.totalFiles > 0 ? importedFileStats.attachments : ctx.attachments;
		const importedDatabaseFiles = importedFileStats.databases;
		const totalImportedFiles =
			importedFileStats.totalFiles > 0
				? importedFileStats.totalFiles
				: importedNotes + importedAttachments;
		const breakdown = [
			`${importedNotes} 个笔记`,
			`${importedAttachments} 个附件`,
		];

		if (importedDatabaseFiles > 0) {
			breakdown.push(`${importedDatabaseFiles} 个数据库文件`);
		}

		const summaryParts = [
			`已导入 ${totalImportedFiles} 个文件`,
			`(${breakdown.join(", ")})`,
			`到 "${versionFolderPath}"`,
		];

		if (importedFileStats.totalFiles > 0 && ctx.notes + ctx.attachments === 0) {
			summaryParts.push(
				"由于 Importer 插件没有上报逐文件进度，以上统计基于 Vault 中实际生成的文件",
			);
		}

		if (ctx.skipped.length > 0) {
			summaryParts.push(`跳过了 ${ctx.skipped.length} 项`);
		}

		if (ctx.failed.length > 0) {
			summaryParts.push(`失败了 ${ctx.failed.length} 项`);
		}

		return `${summaryParts.join(" ")}.`;
	}

	private async updateSyncState(
		status: SyncStatus,
		message: string,
		versionFolderPath: string,
		startedAt?: string,
	): Promise<void> {
		this.settings.lastSyncStatus = status;
		this.settings.lastSyncMessage = message;
		this.settings.lastSyncFolder = versionFolderPath;
		this.settings.lastSyncStartedAt = startedAt ?? this.settings.lastSyncStartedAt;
		this.settings.lastSyncFinishedAt = new Date().toISOString();
		await this.saveSettings();
	}

	private getBaseImportFolder(): string {
		return normalizePath(
			this.readTrimmedValue(this.settings.notionImportBaseFolder, DEFAULT_IMPORT_ROOT),
		);
	}

	async copyLastSyncFolderPath(): Promise<void> {
		const folderPath = this.settings.lastSyncFolder.trim();
		if (!folderPath) {
			new Notice("还没有记录任何 Notion 同步目录。");
			return;
		}

		if (!navigator.clipboard?.writeText) {
			new Notice(`最近的 Notion 同步目录：${folderPath}`);
			return;
		}

		try {
			await navigator.clipboard.writeText(folderPath);
			new Notice(`已复制：${folderPath}`);
		} catch {
			new Notice(`最近的 Notion 同步目录：${folderPath}`);
		}
	}

	private readTrimmedValue(value: string, fallback: string): string {
		const trimmedValue = value.trim();
		return trimmedValue.length > 0 ? trimmedValue : fallback;
	}

	private formatVersionTimestamp(date: Date): string {
		return [
			date.getFullYear().toString().padStart(4, "0"),
			(date.getMonth() + 1).toString().padStart(2, "0"),
			date.getDate().toString().padStart(2, "0"),
			"-",
			date.getHours().toString().padStart(2, "0"),
			date.getMinutes().toString().padStart(2, "0"),
			date.getSeconds().toString().padStart(2, "0"),
		].join("");
	}

	private formatTimestampForDisplay(isoTimestamp: string): string {
		if (!isoTimestamp) {
			return "未知";
		}

		const parsedDate = new Date(isoTimestamp);
		return Number.isNaN(parsedDate.getTime())
			? isoTimestamp
			: parsedDate.toLocaleString();
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message) {
			return error.message;
		}

		return String(error);
	}

	private describeSyncStatus(status: SyncStatus): string {
		switch (status) {
			case "success":
				return "成功";
			case "failed":
				return "失败";
			case "skipped":
				return "已跳过";
			case "idle":
			default:
				return "未运行";
		}
	}
}

class SvgCodeRendererSettingTab extends PluginSettingTab {
	plugin: SvgCodeRendererPlugin;

	constructor(app: App, plugin: SvgCodeRendererPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("svg相关说明").setHeading();

		containerEl.createEl("p", {
			text: '如果notion页面中有内嵌svg代码，同步到Obsidian的svg代码外边会有三个点，导致显示的是代码不是图片，这个插件会将这几个点删除（记得将notion内嵌svg代码标语改成xml）',
		});

		new Setting(containerEl).setName("Notion 同步").setHeading();

		containerEl.createEl("p", {
			text: '依赖社区插件 "Importer"。每次同步都会创建一个新的时间戳子目录，旧版本会自动清理。',
		});

		new Setting(containerEl)
			.setName("Notion API Token")
			.setDesc("用于 Importer -> Notion (API)。")
			.addText((text) => {
				text.setPlaceholder("ntn_...")
					.setValue(this.plugin.settings.notionApiToken)
					.onChange(async (value) => {
						this.plugin.settings.notionApiToken = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("导入根目录")
			.setDesc("每次同步都会在这里创建一个新的时间戳子目录。")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_IMPORT_ROOT)
					.setValue(this.plugin.settings.notionImportBaseFolder)
					.onChange(async (value) => {
						this.plugin.settings.notionImportBaseFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("保留版本数")
			.setDesc("自动清理前保留的快照数量，超过此数量的旧版本会被移到回收站。")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.maxSyncVersions))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1) {
							this.plugin.settings.maxSyncVersions = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("启动时自动同步")
			.setDesc("每次启动 Obsidian 时自动执行一次 Notion 导入。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSyncOnStartup).onChange(async (value) => {
					this.plugin.settings.autoSyncOnStartup = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("公式转换方式")
			.setDesc("与 Notion (API) 导入器中的对应设置保持一致。")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("hybrid", "Obsidian 语法")
					.addOption("static", "静态值")
					.setValue(this.plugin.settings.formulaStrategy)
					.onChange(async (value) => {
						this.plugin.settings.formulaStrategy = value as FormulaImportStrategy;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("下载外部附件")
			.setDesc("导入时将外部 URL 下载为本地文件。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.downloadExternalAttachments)
					.onChange(async (value) => {
						this.plugin.settings.downloadExternalAttachments = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("单行换行")
			.setDesc("在兼容的 Notion 块之间使用单个换行。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.singleLineBreaks).onChange(async (value) => {
					this.plugin.settings.singleLineBreaks = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("封面字段名")
			.setDesc("导入页面封面图片时写入的 Frontmatter 字段名。")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.coverPropertyName)
					.setValue(this.plugin.settings.coverPropertyName)
					.onChange(async (value) => {
						this.plugin.settings.coverPropertyName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("数据库字段名")
			.setDesc("用于将导入页面关联到对应 `.base` 文件的 Frontmatter 字段名。")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.databasePropertyName)
					.setValue(this.plugin.settings.databasePropertyName)
					.onChange(async (value) => {
						this.plugin.settings.databasePropertyName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("上次同步").setHeading();

		containerEl.createEl("p", {
			text: this.plugin.getLastSyncSummary(),
		});

		new Setting(containerEl)
			.setName("立即同步")
			.setDesc("立即创建一个新的版本目录，并导入当前可访问的全部 Notion 内容。")
			.addButton((button) =>
				button.setButtonText("立即同步").setCta().onClick(async () => {
					button.setDisabled(true);
					try {
						await this.plugin.runNotionSync("manual");
					} finally {
						button.setDisabled(false);
						this.display();
					}
				}),
			);

		new Setting(containerEl)
			.setName("复制最近目录")
			.setDesc("将最近一次 Notion 同步目录路径复制到剪贴板。")
			.addButton((button) =>
				button.setButtonText("复制路径").onClick(async () => {
					button.setDisabled(true);
					try {
						await this.plugin.copyLastSyncFolderPath();
					} finally {
						button.setDisabled(false);
					}
				}),
			);
	}
}
