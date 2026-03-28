import {
  App,
  ItemView,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  requestUrl,
} from "obsidian";

const AUTO_FLOW_VIEW_TYPE = "auto-flow-agent-chat";
const DEFAULT_MAX_TOKENS = 1800;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 0.95;
const UPDATED_NOTE_START = "<<<AUTOFLOW_UPDATED_NOTE";
const UPDATED_NOTE_END = "AUTOFLOW_UPDATED_NOTE>>>";

interface AutoFlowAgentSettings {
  spaceUrl: string;
  huggingFaceAccessToken: string;
  defaultSystemPrompt: string;
}

interface AutoFlowMessage {
  role: "user" | "assistant";
  content: string;
  notePath: string;
  updatedNote?: string;
}

interface AutoFlowNoteContext {
  file: TFile;
  content: string;
  selection: string;
}

interface ApiAccessStatusResponse {
  ok?: boolean;
  message?: string;
  username?: string | null;
}

interface ChatApiResponse {
  reply?: string;
  username?: string;
  detail?: string;
}

interface ParsedAssistantResponse {
  reply: string;
  updatedNote?: string;
}

const DEFAULT_SETTINGS: AutoFlowAgentSettings = {
  spaceUrl: "https://huggingface.co/spaces/yizhengjun/AutoFlow-Agent",
  huggingFaceAccessToken: "",
  defaultSystemPrompt:
    "你是一个专业的中文写作助手。你在 Obsidian 插件里协助用户修改当前笔记，回复要简洁、明确、可执行。",
};

export default class AutoFlowAgentPlugin extends Plugin {
  settings!: AutoFlowAgentSettings;
  private statusBarEl: HTMLElement | null = null;
  private messages: AutoFlowMessage[] = [];
  private latestDraftByPath = new Map<string, string>();
  private lastMarkdownLeaf: WorkspaceLeaf | null = null;
  private lastNotePath: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      AUTO_FLOW_VIEW_TYPE,
      (leaf) => new AutoFlowChatView(leaf, this),
    );

    this.addRibbonIcon("messages-square", "Open AutoFlow chat", () => {
      void this.activateChatView();
    });

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("auto-flow-agent-status");
    this.registerDomEvent(this.statusBarEl, "click", () => {
      void this.activateChatView();
    });

    this.addCommand({
      id: "open-chat",
      name: "Open chat",
      callback: async () => {
        await this.activateChatView();
      },
    });

    this.addCommand({
      id: "show-connection-status",
      name: "Show connection status",
      callback: async () => {
        try {
          const status = await this.runConnectionCheck();
          new Notice(status, 8000);
        } catch (error) {
          new Notice(getErrorMessage(error), 8000);
        }
      },
    });

    this.addCommand({
      id: "apply-latest-draft",
      name: "Apply latest draft to current note",
      callback: async () => {
        await this.applyLatestDraftToCurrentNote();
      },
    });

    this.addSettingTab(new AutoFlowAgentSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.captureMarkdownLeaf();
        this.refreshStatusBar();
        this.refreshChatViews();
      }),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file instanceof TFile) {
          this.lastNotePath = file.path;
        }
        this.captureMarkdownLeaf();
        this.refreshStatusBar();
        this.refreshChatViews();
      }),
    );

    this.captureMarkdownLeaf();
    this.refreshStatusBar();
  }

  async onunload(): Promise<void> {
    await this.app.workspace.detachLeavesOfType(AUTO_FLOW_VIEW_TYPE);
    this.statusBarEl = null;
  }

  getResolvedApiBaseUrl(): string | null {
    return normalizeSpaceUrl(this.settings.spaceUrl);
  }

  getMessagesForCurrentNote(notePath: string): AutoFlowMessage[] {
    return this.messages.filter((message) => message.notePath === notePath);
  }

  getLatestDraftForPath(notePath: string): string | undefined {
    return this.latestDraftByPath.get(notePath);
  }

  getCurrentMarkdownView(): MarkdownView | null {
    return this.getPreferredMarkdownView();
  }

  getCurrentNoteFile(): TFile | null {
    return this.getPreferredNoteFile();
  }

  async updateSettings(
    partialSettings: Partial<AutoFlowAgentSettings>,
  ): Promise<void> {
    this.settings = Object.assign({}, this.settings, partialSettings);
    await this.saveData(this.settings);
    this.refreshStatusBar();
    this.refreshChatViews();
  }

  async runConnectionCheck(): Promise<string> {
    const output = await this.requestApi<ApiAccessStatusResponse>(
      "/api/access-status",
      {
        method: "GET",
      },
    );
    return output.message ?? "The server returned an empty status.";
  }

  async sendMessageForCurrentNote(userMessage: string): Promise<AutoFlowMessage> {
    const noteContext = await this.getCurrentNoteContext();
    const trimmedMessage = userMessage.trim();
    if (!trimmedMessage) {
      throw new Error("Enter a message before sending it to AutoFlow.");
    }

    const userTurn: AutoFlowMessage = {
      role: "user",
      content: trimmedMessage,
      notePath: noteContext.file.path,
    };
    this.messages.push(userTurn);
    this.refreshChatViews();

    const history = this.getMessagesForCurrentNote(noteContext.file.path);
    const prompt = buildPrompt(noteContext, history);
    const result = await this.requestApi<ChatApiResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: prompt,
        system_message: this.settings.defaultSystemPrompt,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        top_p: DEFAULT_TOP_P,
      }),
    });

    const rawReply = result.reply?.trim();
    if (!rawReply) {
      const fallbackMessage = result.detail?.trim();
      throw new Error(fallbackMessage || "AutoFlow returned an empty response.");
    }

    const parsed = parseAssistantResponse(rawReply);
    const assistantTurn: AutoFlowMessage = {
      role: "assistant",
      content: parsed.reply,
      notePath: noteContext.file.path,
      updatedNote: parsed.updatedNote,
    };
    this.messages.push(assistantTurn);

    if (parsed.updatedNote) {
      this.latestDraftByPath.set(noteContext.file.path, parsed.updatedNote);
    }

    this.refreshChatViews();
    return assistantTurn;
  }

  async applyLatestDraftToCurrentNote(): Promise<void> {
    const noteContext = await this.getCurrentNoteContext();
    const updatedNote = this.latestDraftByPath.get(noteContext.file.path);
    if (!updatedNote) {
      throw new Error("There is no draft to apply for the current note.");
    }

    await this.writeContentToFile(noteContext.file, updatedNote);
    new Notice(`Updated ${noteContext.file.basename}.`, 5000);
    this.refreshChatViews();
  }

  async activateChatView(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(AUTO_FLOW_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (!rightLeaf) {
        throw new Error("Could not create an AutoFlow chat leaf.");
      }
      leaf = rightLeaf;
      await leaf.setViewState({
        type: AUTO_FLOW_VIEW_TYPE,
        active: true,
      });
    }

    this.app.workspace.revealLeaf(leaf);
    this.refreshChatViews();
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  private async getCurrentNoteContext(): Promise<AutoFlowNoteContext> {
    const markdownView = this.getPreferredMarkdownView();
    const file = this.getPreferredNoteFile();

    if (!(file instanceof TFile)) {
      throw new Error("Open a Markdown note before using AutoFlow chat.");
    }

    const editor = markdownView?.editor;
    const content = editor
      ? editor.getValue()
      : await this.app.vault.cachedRead(file);
    const selection = editor ? editor.getSelection().trim() : "";

    return {
      file,
      content,
      selection,
    };
  }

  private async writeContentToFile(file: TFile, content: string): Promise<void> {
    const activeView = this.getPreferredMarkdownView();
    if (activeView?.file?.path === file.path) {
      activeView.editor?.setValue(content);
      return;
    }

    await this.app.vault.process(file, () => content);
  }

  private async requestApi<T>(
    path: string,
    options: {
      method: "GET" | "POST";
      body?: string;
    },
  ): Promise<T> {
    const apiBaseUrl = this.getResolvedApiBaseUrl();
    if (!apiBaseUrl) {
      throw new Error("Set the backend URL in plugin settings first.");
    }

    const headers = this.getRequestHeaders();
    const response = await requestUrl({
      url: `${apiBaseUrl}${path}`,
      method: options.method,
      headers,
      body: options.body,
      throw: false,
    });

    const responseBody = parseJsonResponse(response.text);
    if (response.status >= 400) {
      throw new Error(extractApiError(responseBody, response.status));
    }

    if (!responseBody) {
      throw new Error("The server response was empty.");
    }

    return responseBody as T;
  }

  private getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = this.settings.huggingFaceAccessToken.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private refreshStatusBar(): void {
    if (!this.statusBarEl) {
      return;
    }

    const activeFile = this.getPreferredNoteFile();
    const token = this.settings.huggingFaceAccessToken.trim();
    const apiBaseUrl = this.getResolvedApiBaseUrl();

    if (!activeFile) {
      this.statusBarEl.setText("AutoFlow: open note");
      return;
    }

    if (!apiBaseUrl) {
      this.statusBarEl.setText("AutoFlow: set backend");
      return;
    }

    if (!token) {
      this.statusBarEl.setText("AutoFlow: set token");
      return;
    }

    this.statusBarEl.setText(`AutoFlow: ${activeFile.basename}`);
    this.statusBarEl.setAttribute(
      "aria-label",
      `Open AutoFlow chat for ${activeFile.basename}`,
    );
  }

  private refreshChatViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(AUTO_FLOW_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof AutoFlowChatView) {
        view.refresh();
      }
    }
  }

  private captureMarkdownLeaf(): void {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf?.view instanceof MarkdownView) {
      this.lastMarkdownLeaf = activeLeaf;
      if (activeLeaf.view.file instanceof TFile) {
        this.lastNotePath = activeLeaf.view.file.path;
      }
      return;
    }

    const openFile = this.app.workspace.getActiveFile();
    if (!openFile) {
      return;
    }

    const matchingLeaf = this.app.workspace
      .getLeavesOfType("markdown")
      .find((leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === openFile.path);

    if (matchingLeaf) {
      this.lastMarkdownLeaf = matchingLeaf;
      const matchingView = matchingLeaf.view;
      if (matchingView instanceof MarkdownView && matchingView.file instanceof TFile) {
        this.lastNotePath = matchingView.file.path;
      }
    }
  }

  private getPreferredMarkdownView(): MarkdownView | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      if (activeView.file instanceof TFile) {
        this.lastNotePath = activeView.file.path;
      }
      return activeView;
    }

    const rememberedView = this.lastMarkdownLeaf?.view;
    if (rememberedView instanceof MarkdownView && rememberedView.file instanceof TFile) {
      this.lastNotePath = rememberedView.file.path;
      return rememberedView;
    }

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView && leaf.view.file instanceof TFile) {
        this.lastMarkdownLeaf = leaf;
        this.lastNotePath = leaf.view.file.path;
        return leaf.view;
      }
    }

    return null;
  }

  private getPreferredNoteFile(): TFile | null {
    const markdownView = this.getPreferredMarkdownView();
    if (markdownView?.file instanceof TFile) {
      return markdownView.file;
    }

    if (this.lastNotePath) {
      const abstractFile = this.app.vault.getAbstractFileByPath(this.lastNotePath);
      if (abstractFile instanceof TFile) {
        return abstractFile;
      }
    }

    return null;
  }
}

class AutoFlowChatView extends ItemView {
  private contextEl!: HTMLElement;
  private messageListEl!: HTMLElement;
  private composerEl!: HTMLTextAreaElement;
  private sendButtonEl!: HTMLButtonElement;
  private applyButtonEl!: HTMLButtonElement;
  private helperEl!: HTMLElement;
  private isSending = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: AutoFlowAgentPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return AUTO_FLOW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "AutoFlow chat";
  }

  getIcon(): string {
    return "messages-square";
  }

  async onOpen(): Promise<void> {
    this.renderLayout();
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  refresh(): void {
    if (!this.contextEl) {
      return;
    }

    this.renderContext();
    this.renderMessages();
    this.renderDraftState();
  }

  private renderLayout(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-flow-chat");

    const headerEl = contentEl.createDiv({ cls: "auto-flow-chat__header" });
    headerEl.createEl("h2", { text: "AutoFlow chat" });

    this.contextEl = contentEl.createDiv({ cls: "auto-flow-chat__context" });

    this.messageListEl = contentEl.createDiv({
      cls: "auto-flow-chat__messages",
    });

    const actionRowEl = contentEl.createDiv({
      cls: "auto-flow-chat__action-row",
    });

    this.applyButtonEl = actionRowEl.createEl("button", {
      cls: "mod-cta",
      text: "Apply latest draft",
    });
    this.applyButtonEl.addEventListener("click", async () => {
      await this.handleApplyDraft();
    });

    const testButtonEl = actionRowEl.createEl("button", {
      text: "Test connection",
    });
    testButtonEl.addEventListener("click", async () => {
      await this.handleConnectionCheck();
    });

    this.helperEl = contentEl.createDiv({ cls: "auto-flow-chat__helper" });
    this.helperEl.setText(
      "Ask for changes like: rewrite this note as a concise summary, turn it into bullet points, or polish the tone.",
    );

    const composerWrapEl = contentEl.createDiv({
      cls: "auto-flow-chat__composer",
    });

    this.composerEl = composerWrapEl.createEl("textarea", {
      cls: "auto-flow-chat__input",
      attr: {
        "aria-label": "Send a request to AutoFlow",
        placeholder: "Tell AutoFlow how to change the current note...",
      },
    });
    this.composerEl.rows = 5;
    this.composerEl.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void this.handleSend();
      }
    });

    this.sendButtonEl = composerWrapEl.createEl("button", {
      cls: "mod-cta auto-flow-chat__send",
      text: "Send",
    });
    this.sendButtonEl.addEventListener("click", async () => {
      await this.handleSend();
    });
  }

  private renderContext(): void {
    this.contextEl.empty();

    const activeView = this.plugin.getCurrentMarkdownView();
    const file = activeView?.file ?? this.plugin.getCurrentNoteFile();

    if (!(file instanceof TFile)) {
      this.contextEl.createEl("p", {
        text: "Open a Markdown note to start chatting with AutoFlow.",
      });
      return;
    }

    this.contextEl.createEl("p", {
      text: `Current note: ${file.basename}`,
    });

    const selection = activeView?.editor?.getSelection().trim() ?? "";
    this.contextEl.createEl("p", {
      text: selection
        ? "Selected text will be included as extra context."
        : "No text is selected. AutoFlow will work on the full note.",
    });
  }

  private renderMessages(): void {
    this.messageListEl.empty();

    const activeFile = this.plugin.getCurrentNoteFile();
    if (!(activeFile instanceof TFile)) {
      return;
    }

    const messages = this.plugin.getMessagesForCurrentNote(activeFile.path);
    if (messages.length === 0) {
      const emptyStateEl = this.messageListEl.createDiv({
        cls: "auto-flow-chat__empty",
      });
      emptyStateEl.setText(
        "No messages yet. Tell AutoFlow how you want the current note changed.",
      );
      return;
    }

    for (const message of messages) {
      const itemEl = this.messageListEl.createDiv({
        cls: `auto-flow-chat__message auto-flow-chat__message--${message.role}`,
      });

      itemEl.createEl("div", {
        cls: "auto-flow-chat__role",
        text: message.role === "user" ? "You" : "AutoFlow",
      });
      itemEl.createEl("div", {
        cls: "auto-flow-chat__bubble",
        text: message.content,
      });

      if (message.updatedNote) {
        itemEl.createEl("div", {
          cls: "auto-flow-chat__draft-tag",
          text: "A replacement draft is ready for this note.",
        });
      }
    }

    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private renderDraftState(): void {
    const activeFile = this.plugin.getCurrentNoteFile();
    const hasDraft =
      activeFile instanceof TFile &&
      Boolean(this.plugin.getLatestDraftForPath(activeFile.path));

    this.applyButtonEl.disabled = !hasDraft || this.isSending;
    this.sendButtonEl.disabled = this.isSending;
    this.composerEl.disabled = this.isSending;
    this.sendButtonEl.setText(this.isSending ? "Sending..." : "Send");
  }

  private async handleSend(): Promise<void> {
    const message = this.composerEl.value.trim();
    if (!message) {
      new Notice("Enter a request before sending it to AutoFlow.");
      return;
    }

    this.isSending = true;
    this.renderDraftState();

    try {
      await this.plugin.sendMessageForCurrentNote(message);
      this.composerEl.value = "";
    } catch (error) {
      new Notice(getErrorMessage(error), 8000);
    } finally {
      this.isSending = false;
      this.refresh();
      this.composerEl.focus();
    }
  }

  private async handleApplyDraft(): Promise<void> {
    try {
      await this.plugin.applyLatestDraftToCurrentNote();
    } catch (error) {
      new Notice(getErrorMessage(error), 8000);
    }
  }

  private async handleConnectionCheck(): Promise<void> {
    try {
      const status = await this.plugin.runConnectionCheck();
      new Notice(status, 8000);
    } catch (error) {
      new Notice(getErrorMessage(error), 8000);
    }
  }
}

class AutoFlowAgentSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: AutoFlowAgentPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.settings;

    containerEl.empty();

    new Setting(containerEl).setName("Connection").setHeading();

    new Setting(containerEl)
      .setName("Backend URL")
      .setDesc("Set the backend page or host for AutoFlow.")
      .addText((text) => {
        text
          .setPlaceholder("https://example.com")
          .setValue(settings.spaceUrl)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              spaceUrl: value.trim(),
            });
          });
      });

    new Setting(containerEl)
      .setName("Hugging Face access token")
      .setDesc("Paste an access token so the plugin can call the backend directly.")
      .addText((text) => {
        text
          .setPlaceholder("hf_...")
          .setValue(settings.huggingFaceAccessToken)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              huggingFaceAccessToken: value.trim(),
            });
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl).setName("Assistant").setHeading();

    new Setting(containerEl)
      .setName("Default system prompt")
      .setDesc("Change how AutoFlow behaves across the chat panel.")
      .addTextArea((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.defaultSystemPrompt)
          .setValue(settings.defaultSystemPrompt)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              defaultSystemPrompt: value,
            });
          });
        text.inputEl.rows = 4;
      });
  }
}

function normalizeSpaceUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (parsedUrl.hostname === "huggingface.co") {
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      if (pathSegments[0] === "spaces" && pathSegments.length >= 3) {
        return `https://${pathSegments[1]}-${pathSegments[2]}.hf.space`;
      }
    }

    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function buildPrompt(
  noteContext: AutoFlowNoteContext,
  messages: AutoFlowMessage[],
): string {
  const conversationText = messages
    .map((message) => {
      const speaker = message.role === "user" ? "用户" : "助手";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");

  const selectionText = noteContext.selection || "无";

  return [
    "你正在一个 Obsidian 插件里协助用户修改当前笔记。",
    "先用简洁中文回复你会怎么处理。",
    `如果需要改动笔记，请在回复最后附上完整的新笔记，格式必须严格如下：`,
    UPDATED_NOTE_START,
    "在这里放完整的新笔记内容",
    UPDATED_NOTE_END,
    "如果这次不需要修改笔记，就不要输出这个区块。",
    "",
    `当前笔记标题：${noteContext.file.basename}`,
    `当前笔记路径：${noteContext.file.path}`,
    `当前选中文本：${selectionText}`,
    "",
    "当前笔记全文：",
    noteContext.content,
    "",
    "最近对话：",
    conversationText || "无",
  ].join("\n");
}

function parseAssistantResponse(rawText: string): ParsedAssistantResponse {
  const startIndex = rawText.indexOf(UPDATED_NOTE_START);
  const endIndex = rawText.indexOf(UPDATED_NOTE_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {
      reply: rawText.trim(),
    };
  }

  const reply = rawText.slice(0, startIndex).trim();
  const updatedNote = rawText
    .slice(startIndex + UPDATED_NOTE_START.length, endIndex)
    .trim();

  return {
    reply: reply || "AutoFlow prepared a replacement draft for the note.",
    updatedNote,
  };
}

function parseJsonResponse(rawText: string): unknown {
  const trimmedText = rawText.trim();
  if (!trimmedText) {
    return null;
  }

  try {
    return JSON.parse(trimmedText) as unknown;
  } catch {
    return {
      detail: trimmedText,
    };
  }
}

function extractApiError(responseBody: unknown, status: number): string {
  if (responseBody && typeof responseBody === "object") {
    const detail = Reflect.get(responseBody, "detail");
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    const message = Reflect.get(responseBody, "message");
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return `The server rejected the request with status ${status}.`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "AutoFlow failed for an unknown reason.";
}
