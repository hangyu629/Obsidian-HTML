import type { HtmlAnnotationStore } from "./annotation-store";
import type { HtmlAnnotation } from "./types";

export interface AnnotationViewAdapter {
  readonly sourcePath: string;
  beginAnnotationRepair?(id: string): Promise<boolean> | boolean;
  focusAnnotation(id: string): Promise<boolean>;
  removeAnnotation?(id: string): Promise<void> | void;
  saveAnnotation?(annotation: HtmlAnnotation): Promise<void> | void;
}

type AnnotationPersistence = Pick<
  HtmlAnnotationStore,
  "load" | "removeAnnotation" | "saveFileAnnotation"
>;

export class AnnotationService {
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly views = new Set<AnnotationViewAdapter>();

  constructor(private readonly store: AnnotationPersistence) {}

  load(sourcePath: string): Promise<HtmlAnnotation[]> {
    return this.store.load(sourcePath);
  }

  async save(sourcePath: string, annotation: HtmlAnnotation): Promise<void> {
    await this.store.saveFileAnnotation(sourcePath, annotation);
    await this.syncViews(sourcePath, (view) => view.saveAnnotation?.(annotation));
    this.emit(sourcePath);
  }

  async remove(annotation: HtmlAnnotation): Promise<void> {
    await this.store.removeAnnotation(annotation);
    await this.syncViews(annotation.sourcePath, (view) => view.removeAnnotation?.(annotation.id));
    this.emit(annotation.sourcePath);
  }

  subscribe(sourcePath: string, listener: () => void): () => void {
    let listeners = this.listeners.get(sourcePath);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(sourcePath, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) this.listeners.delete(sourcePath);
    };
  }

  registerView(view: AnnotationViewAdapter): () => void {
    this.views.add(view);
    return () => this.views.delete(view);
  }

  async focus(sourcePath: string, id: string): Promise<boolean> {
    const candidates = [...this.views]
      .filter((view) => view.sourcePath === sourcePath)
      .reverse();
    for (const view of candidates) {
      if (await view.focusAnnotation(id)) return true;
    }
    return false;
  }

  async beginAnnotationRepair(sourcePath: string, id: string): Promise<boolean> {
    const candidates = [...this.views]
      .filter((view) => view.sourcePath === sourcePath)
      .reverse();
    for (const view of candidates) {
      if (await view.beginAnnotationRepair?.(id)) return true;
    }
    return false;
  }

  private emit(sourcePath: string): void {
    for (const listener of this.listeners.get(sourcePath) ?? []) listener();
  }

  private async syncViews(
    sourcePath: string,
    callback: (view: AnnotationViewAdapter) => Promise<void> | void
  ): Promise<void> {
    for (const view of [...this.views].filter((candidate) => candidate.sourcePath === sourcePath)) {
      await callback(view);
    }
  }
}
