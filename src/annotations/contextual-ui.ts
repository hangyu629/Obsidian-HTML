import type { AnnotationSelection } from "./dom";
import {
  ANNOTATION_COLORS,
  annotationDisplayColor,
  type AnnotationColor,
  type HtmlAnnotation,
  type HtmlAnnotationTarget
} from "./types";

export interface AnnotationDraft {
  color: AnnotationColor;
  comment: string;
  id?: string;
  quote: string;
  target: HtmlAnnotationTarget;
}

export interface AnnotationContextualUiCallbacks {
  onDelete(annotation: HtmlAnnotation): Promise<boolean>;
  onSave(draft: AnnotationDraft): Promise<boolean>;
}

const COLOR_LABELS: Record<AnnotationColor, string> = {
  blue: "蓝色",
  green: "绿色",
  pink: "粉色",
  violet: "紫色",
  yellow: "黄色"
};

let lastUsedColor: AnnotationColor = "yellow";

export class AnnotationContextualUi {
  private surface: HTMLElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: AnnotationContextualUiCallbacks
  ) {}

  showSelection(
    selection: AnnotationSelection,
    anchor: DOMRect,
    existing?: HtmlAnnotation
  ): void {
    this.close();
    const initial: AnnotationDraft = {
      color: existing ? annotationDisplayColor(existing) : "yellow",
      comment: existing?.comment ?? "",
      ...(existing?.id ? { id: existing.id } : {}),
      quote: selection.quote,
      target: selection.target
    };
    if (existing) {
      this.showEditor(initial, anchor, existing, true);
      return;
    }
    const toolbar = this.createSurface("div", "annotation-selection-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "选中文字操作");
    toolbar.addEventListener("mousedown", (event) => event.preventDefault());

    const color = this.button("颜色", "annotation-toolbar-button");
    const comment = this.button("注释", "annotation-toolbar-button");
    color.addEventListener("click", () => {
      const existing = toolbar.querySelector(".annotation-toolbar-palette");
      if (existing) {
        existing.remove();
        return;
      }
      const palette = this.createPalette(existing ? initial.color : lastUsedColor, async (selected) => {
        lastUsedColor = selected;
        const saved = await this.save({
          ...initial,
          color: selected,
          comment: initial.comment
        });
        if (saved) this.close();
      });
      palette.classList.add("annotation-toolbar-palette");
      toolbar.append(palette);
      this.place(toolbar, anchor);
    });
    comment.addEventListener("click", () => {
      this.showEditor(
        {
          ...initial,
          color: existing ? initial.color : "yellow"
        },
        anchor,
        existing
      );
    });
    toolbar.append(color, comment);
    this.mount(toolbar, anchor);
  }

  showAnnotation(annotation: HtmlAnnotation, anchor: DOMRect): void {
    this.showEditor(
      {
        color: annotationDisplayColor(annotation),
        comment: annotation.comment,
        id: annotation.id,
        quote: annotation.quote,
        target: annotation.target
      },
      anchor,
      annotation
    );
  }

  close(): void {
    this.surface?.remove();
    this.surface = null;
  }

  destroy(): void {
    this.close();
  }

  private showEditor(
    initial: AnnotationDraft,
    anchor: DOMRect,
    existing?: HtmlAnnotation,
    repairing = false
  ): void {
    this.close();
    const draft = { ...initial };
    const editor = this.createSurface("div", "annotation-editor");
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", repairing ? "重新定位批注" : (existing ? "编辑注释" : "添加注释"));

    const header = document.createElement("div");
    header.className = "annotation-editor-header";
    const title = document.createElement("strong");
    title.textContent = repairing ? "重新定位批注" : (existing ? "编辑注释" : "添加注释");
    const close = this.button("×", "annotation-editor-close");
    close.setAttribute("aria-label", "关闭");
    close.addEventListener("click", () => this.close());
    header.append(title, close);
    if (repairing) {
      const hint = document.createElement("p");
      hint.className = "annotation-editor-repair-hint";
      hint.textContent = "已替换摘录位置，保存后将更新这条批注。";
      header.append(hint);
    }

    const quote = document.createElement("blockquote");
    quote.className = "annotation-editor-quote";
    quote.textContent = `“${initial.quote}”`;

    const palette = this.createPalette(draft.color, (selected) => {
      draft.color = selected;
      this.selectSwatch(palette, selected);
    });

    const textarea = document.createElement("textarea");
    textarea.className = "annotation-editor-comment";
    textarea.placeholder = "写下你的想法…";
    textarea.setAttribute("aria-label", "注释内容");
    textarea.value = initial.comment;

    const actions = document.createElement("div");
    actions.className = "annotation-editor-actions";
    if (existing) {
      const remove = this.button("删除高亮", "annotation-editor-delete");
      remove.addEventListener("click", () => {
        void this.remove(existing);
      });
      actions.append(remove);
    } else {
      actions.append(document.createElement("span"));
    }
    const commands = document.createElement("div");
    commands.className = "annotation-editor-commands";
    if (!existing) {
      const highlight = this.button("仅高亮", "annotation-editor-secondary");
      highlight.addEventListener("click", () => {
        void this.saveAndClose({ ...draft, comment: "" });
      });
      commands.append(highlight);
    }
    const submit = this.button(
      existing ? "保存修改" : "保存批注",
      "annotation-editor-primary"
    );
    const saveComment = () => {
      void this.saveAndClose({ ...draft, comment: textarea.value.trim() });
    };
    submit.addEventListener("click", saveComment);
    commands.append(submit);
    actions.append(commands);

    editor.append(header, quote, palette, textarea, actions);
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        saveComment();
      }
    });
    this.mount(editor, anchor);
    textarea.focus();
  }

  private createPalette(
    selected: AnnotationColor,
    onSelect: (color: AnnotationColor) => void | Promise<void>
  ): HTMLElement {
    const palette = document.createElement("div");
    palette.className = "annotation-color-palette";
    palette.setAttribute("aria-label", "高亮颜色");
    for (const color of ANNOTATION_COLORS) {
      const swatch = this.button("", "annotation-color-swatch");
      swatch.dataset.color = color;
      swatch.setAttribute("aria-label", COLOR_LABELS[color]);
      swatch.setAttribute("aria-pressed", color === selected ? "true" : "false");
      swatch.addEventListener("click", () => {
        this.selectSwatch(palette, color);
        void onSelect(color);
      });
      palette.append(swatch);
    }
    return palette;
  }

  private selectSwatch(palette: HTMLElement, selected: AnnotationColor): void {
    for (const swatch of palette.querySelectorAll<HTMLElement>("[data-color]")) {
      swatch.setAttribute(
        "aria-pressed",
        swatch.dataset.color === selected ? "true" : "false"
      );
    }
  }

  private createSurface(tag: "div", className: string): HTMLElement {
    const surface = document.createElement(tag);
    surface.className = `annotation-contextual-surface ${className}`;
    return surface;
  }

  private button(text: string, className: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }

  private mount(surface: HTMLElement, anchor: DOMRect): void {
    this.surface = surface;
    this.host.append(surface);
    this.place(surface, anchor);
  }

  private place(surface: HTMLElement, anchor: DOMRect): void {
    const inset = 8;
    const gap = 10;
    const bounds = surface.getBoundingClientRect();
    const width = bounds.width || (surface.classList.contains("annotation-editor") ? 360 : 150);
    const height = bounds.height || (surface.classList.contains("annotation-editor") ? 280 : 42);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centered = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.max(inset, Math.min(centered, viewportWidth - width - inset));
    const below = anchor.bottom + gap;
    const top = below + height <= viewportHeight - inset
      ? below
      : Math.max(inset, anchor.top - height - gap);
    surface.style.left = `${Math.round(left)}px`;
    surface.style.top = `${Math.round(top)}px`;
  }

  private async save(draft: AnnotationDraft): Promise<boolean> {
    try {
      return await this.callbacks.onSave(draft);
    } catch {
      return false;
    }
  }

  private async saveAndClose(draft: AnnotationDraft): Promise<void> {
    if (await this.save(draft)) this.close();
  }

  private async remove(annotation: HtmlAnnotation): Promise<void> {
    try {
      if (await this.callbacks.onDelete(annotation)) this.close();
    } catch {
      // Keep the editor open so the user can retry.
    }
  }
}
