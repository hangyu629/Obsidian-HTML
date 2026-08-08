interface PreviewSubscription {
  dependencies: Set<string>;
  refresh: () => void;
  sourcePath: string;
  timer: ReturnType<typeof setTimeout> | null;
}

export class PreviewCoordinator {
  private readonly subscriptions = new Map<string, PreviewSubscription>();

  constructor(private readonly delayMs = 250) {}

  subscribe(
    viewId: string,
    sourcePath: string,
    dependencies: ReadonlySet<string>,
    refresh: () => void
  ): () => void {
    this.remove(viewId);
    const subscription: PreviewSubscription = {
      dependencies: new Set(dependencies),
      refresh,
      sourcePath,
      timer: null
    };
    this.subscriptions.set(viewId, subscription);

    return () => {
      if (this.subscriptions.get(viewId) === subscription) {
        this.remove(viewId);
      }
    };
  }

  update(
    viewId: string,
    sourcePath: string,
    dependencies: ReadonlySet<string>
  ): void {
    const subscription = this.subscriptions.get(viewId);
    if (!subscription) {
      return;
    }
    subscription.sourcePath = sourcePath;
    subscription.dependencies = new Set(dependencies);
  }

  notify(path: string): void {
    for (const subscription of this.subscriptions.values()) {
      if (
        path !== subscription.sourcePath &&
        !subscription.dependencies.has(path)
      ) {
        continue;
      }
      if (subscription.timer !== null) {
        clearTimeout(subscription.timer);
      }
      subscription.timer = setTimeout(() => {
        subscription.timer = null;
        subscription.refresh();
      }, this.delayMs);
    }
  }

  dispose(): void {
    for (const viewId of [...this.subscriptions.keys()]) {
      this.remove(viewId);
    }
  }

  private remove(viewId: string): void {
    const subscription = this.subscriptions.get(viewId);
    if (!subscription) {
      return;
    }
    if (subscription.timer !== null) {
      clearTimeout(subscription.timer);
    }
    this.subscriptions.delete(viewId);
  }
}
