type EventCallback = EventListenerOrEventListenerObject;

export class Component {
  private cleanups: Array<() => void> = [];

  registerDomEvent(
    element: EventTarget,
    type: string,
    callback: EventCallback
  ): void {
    element.addEventListener(type, callback);
    this.cleanups.push(() => element.removeEventListener(type, callback));
  }

  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  registerEvent(): void {}

  onunload(): void {
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
  }

  unload(): void {
    this.onunload();
  }
}

export class MarkdownRenderer {
  static async render(
    _app: unknown,
    markdown: string,
    element: HTMLElement,
    _sourcePath: string,
    _component: Component
  ): Promise<void> {
    element.textContent = markdown;
  }
}

export class TFile {
  basename: string;
  extension: string;
  name: string;

  constructor(public path: string) {
    this.name = path.split("/").pop() ?? path;
    const dot = this.name.lastIndexOf(".");
    this.extension = dot >= 0 ? this.name.slice(dot + 1) : "";
    this.basename = dot >= 0 ? this.name.slice(0, dot) : this.name;
  }
}


export class WorkspaceLeaf {
  constructor(public app: unknown) {}

  async setViewState(): Promise<void> {}
}

export class ItemView extends Component {
  app: any;
  containerEl = document.createElement("div");
  contentEl = document.createElement("div");
  actions: Array<{
    callback: (event: MouseEvent) => unknown;
    element: HTMLElement;
    icon: string;
    title: string;
  }> = [];

  constructor(public leaf: WorkspaceLeaf) {
    super();
    this.app = leaf.app;
    this.containerEl.append(this.contentEl);
  }

  addAction(icon: string, title: string, callback: (event: MouseEvent) => unknown): HTMLElement {
    const element = document.createElement("button");
    this.actions.push({ callback, element, icon, title });
    return element;
  }

  getViewType(): string {
    return "mock";
  }
}

export class FileView extends ItemView {
  allowNoFile = false;
  file: TFile | null = null;
  navigation = true;

  getDisplayText(): string {
    return this.file?.basename ?? "";
  }

  getState(): Record<string, unknown> {
    return {};
  }

  async setState(): Promise<void> {}
  async onLoadFile(): Promise<void> {}
  async onUnloadFile(): Promise<void> {}
  async onRename(): Promise<void> {}
  onload(): void {}
}

export class Modal extends Component {
  contentEl = document.createElement("div");
  titleEl = document.createElement("h2");
  constructor(public app: unknown) {
    super();
  }
  open(): void {
    this.onOpen();
    document.body.append(this.titleEl, this.contentEl);
  }
  close(): void {
    this.onClose();
    this.titleEl.remove();
    this.contentEl.remove();
  }
  onOpen(): void {}
  onClose(): void {}
}

export class Plugin extends Component {
  app: any;
  manifest: any;
  registeredExtensions: Array<{ extensions: string[]; viewType: string }> = [];
  registeredViews = new Map<string, (leaf: WorkspaceLeaf) => ItemView>();
  settingTabs: unknown[] = [];
  commands: Array<Record<string, unknown>> = [];
  private data: unknown = null;

  constructor(app: unknown = {}, manifest: unknown = {}) {
    super();
    this.app = app;
    this.manifest = manifest;
  }

  addSettingTab(tab: unknown): void {
    this.settingTabs.push(tab);
  }

  async loadData(): Promise<unknown> {
    return this.data;
  }

  registerExtensions(extensions: string[], viewType: string): void {
    this.registeredExtensions.push({ extensions, viewType });
  }

  registerView(
    viewType: string,
    creator: (leaf: WorkspaceLeaf) => ItemView
  ): void {
    this.registeredViews.set(viewType, creator);
  }

  addCommand(command: Record<string, unknown>): void {
    this.commands.push(command);
  }

  async saveData(data: unknown): Promise<void> {
    this.data = data;
  }
}
export class PluginSettingTab extends Component {
  containerEl = document.createElement("div");
}
export class Setting {
  readonly element: HTMLElement;
  readonly settingEl: HTMLElement;
  constructor(container: HTMLElement) {
    this.element = document.createElement("div");
    this.settingEl = this.element;
    container.append(this.element);
  }
  setName(name: string): this {
    const label = document.createElement("span");
    label.className = "setting-name";
    label.textContent = name;
    this.element.append(label);
    return this;
  }
  setDesc(_description: string): this { return this; }
  addToggle(callback: (toggle: this) => unknown): this { callback(this); return this; }
  setValue(_value: unknown): this { return this; }
  setPlaceholder(_value: string): this { return this; }
  onChange(_callback: (value: unknown) => unknown): this { return this; }
  addText(callback: (text: this) => unknown): this { callback(this); return this; }
  addDropdown(callback: (dropdown: { selectEl: HTMLSelectElement; addOption: (value: string, display: string) => unknown; setValue: (value: string) => unknown; onChange: (callback: (value: string) => unknown) => unknown }) => unknown): this {
    const selectEl = document.createElement("select");
    const dropdown = {
      selectEl,
      addOption: (value: string, display: string) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = display;
        selectEl.append(option);
      },
      setValue: (value: string) => {
        selectEl.value = value;
      },
      onChange: (change: (value: string) => unknown) => {
        selectEl.addEventListener("change", () => void change(selectEl.value));
      }
    };
    this.element.append(selectEl);
    callback(dropdown);
    return this;
  }
  addButton(callback: (button: this) => unknown): this { callback(this); return this; }
  addExtraButton(callback: (button: this) => unknown): this { callback(this); return this; }
  setButtonText(_text: string): this { return this; }
  setIcon(_icon: string): this { return this; }
  setTooltip(_tooltip: string): this { return this; }
  onClick(_callback: () => unknown): this { return this; }
}

export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export function setIcon(element: HTMLElement, icon: string): void {
  element.dataset.icon = icon;
}
