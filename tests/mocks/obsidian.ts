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

  registerEvent(): void {}

  onunload(): void {
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
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
}

export class ItemView extends Component {
  app: any;
  containerEl = document.createElement("div");
  contentEl = document.createElement("div");
  actions: Array<{ callback: (event: MouseEvent) => unknown; icon: string; title: string }> = [];

  constructor(public leaf: WorkspaceLeaf) {
    super();
    this.app = leaf.app;
    this.containerEl.append(this.contentEl);
  }

  addAction(icon: string, title: string, callback: (event: MouseEvent) => unknown): HTMLElement {
    this.actions.push({ callback, icon, title });
    return document.createElement("button");
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
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class Plugin extends Component {}
export class PluginSettingTab extends Component {}
export class Setting {
  constructor(_container: HTMLElement) {}
}

export function setIcon(element: HTMLElement, icon: string): void {
  element.dataset.icon = icon;
}

