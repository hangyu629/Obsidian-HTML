import { Modal, type App } from "obsidian";

import {
  COMMAND_CARD_LANGUAGES,
  type CommandCardInput,
  type CommandCardLanguage,
  normalizeCommandCardInput,
  validateCommandCardInput
} from "./command-card";

export interface InsertCommandCardModalOptions {
  initialCommand: string;
  initialLanguage: CommandCardLanguage;
  onInsert(
    input: CommandCardInput & { language: CommandCardLanguage }
  ): void;
}

interface CommandCardFields {
  command: HTMLTextAreaElement;
  description: HTMLTextAreaElement;
  language: HTMLSelectElement;
  title: HTMLInputElement;
}

const LANGUAGE_LABELS: Record<CommandCardLanguage, string> = {
  bash: "Bash",
  dockerfile: "Dockerfile",
  javascript: "JavaScript",
  json: "JSON",
  powershell: "PowerShell",
  python: "Python",
  shell: "Shell",
  sql: "SQL",
  text: "Plain text",
  typescript: "TypeScript",
  yaml: "YAML"
};

export class InsertCommandCardModal extends Modal {
  private errorEl: HTMLParagraphElement | null = null;
  private fields: CommandCardFields | null = null;
  private submitted = false;
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.submit();
    }
  };

  constructor(
    app: App,
    private readonly options: InsertCommandCardModalOptions
  ) {
    super(app);
  }

  onOpen(): void {
    this.submitted = false;
    this.modalEl.classList.add("command-card-insert-dialog");
    this.titleEl.textContent = "Insert command card";
    this.contentEl.replaceChildren();

    const root = document.createElement("form");
    root.className = "command-card-modal";

    const intro = document.createElement("p");
    intro.className = "command-card-modal-intro";
    intro.textContent = "Create a reusable command callout for Enhanced Preview.";

    const metadata = document.createElement("div");
    metadata.className = "command-card-modal-metadata";
    const title = document.createElement("input");
    title.type = "text";
    title.autocomplete = "off";
    title.placeholder = "For example, Check repository status";
    title.dataset.commandCardField = "title";
    const language = document.createElement("select");
    language.dataset.commandCardField = "language";
    for (const value of COMMAND_CARD_LANGUAGES) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = LANGUAGE_LABELS[value];
      language.append(option);
    }
    language.value = this.options.initialLanguage;
    metadata.append(
      this.createField("Title", title, true),
      this.createField("Language", language)
    );

    const command = document.createElement("textarea");
    command.rows = 6;
    command.spellcheck = false;
    command.placeholder = "Enter one or more commands";
    command.value = this.options.initialCommand;
    command.dataset.commandCardField = "command";

    const description = document.createElement("textarea");
    description.rows = 3;
    description.placeholder = "Add context, prerequisites, or expected output";
    description.dataset.commandCardField = "description";

    this.errorEl = document.createElement("p");
    this.errorEl.className = "command-card-modal-error";
    this.errorEl.setAttribute("role", "alert");
    this.errorEl.setAttribute("aria-live", "polite");

    const actions = document.createElement("div");
    actions.className = "command-card-modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.dataset.commandCardAction = "cancel";
    cancel.addEventListener("click", () => this.close());
    const insert = document.createElement("button");
    insert.type = "submit";
    insert.className = "mod-cta";
    insert.textContent = "Insert card";
    insert.dataset.commandCardAction = "insert";
    actions.append(cancel, insert);

    root.append(
      intro,
      metadata,
      this.createField("Command", command, true),
      this.createField("Description", description),
      this.errorEl,
      actions
    );
    this.contentEl.append(root);
    this.fields = { command, description, language, title };

    root.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
    this.contentEl.addEventListener("keydown", this.handleKeydown);
    for (const input of [title, language, command, description]) {
      input.addEventListener("input", () => this.showError(""));
    }

    title.focus();
  }

  onClose(): void {
    this.modalEl.classList.remove("command-card-insert-dialog");
    this.contentEl.removeEventListener("keydown", this.handleKeydown);
    this.contentEl.replaceChildren();
    this.fields = null;
    this.errorEl = null;
  }

  private createField(
    labelText: string,
    control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    required = false
  ): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "command-card-modal-field";
    const heading = document.createElement("span");
    heading.className = "command-card-modal-label";
    heading.textContent = labelText;
    if (required) {
      const marker = document.createElement("span");
      marker.className = "command-card-modal-required";
      marker.textContent = "Required";
      heading.append(marker);
    }
    label.append(heading, control);
    return label;
  }

  private submit(): void {
    if (this.submitted || !this.fields) return;

    const input: CommandCardInput = {
      command: this.fields.command.value,
      description: this.fields.description.value,
      language: this.fields.language.value,
      title: this.fields.title.value
    };
    const error = validateCommandCardInput(input);
    if (error) {
      this.showError(error);
      const target = error === "Enter a title."
        ? this.fields.title
        : this.fields.command;
      target.focus();
      return;
    }

    this.submitted = true;
    this.options.onInsert(normalizeCommandCardInput(input));
    this.close();
  }

  private showError(message: string): void {
    if (this.errorEl) this.errorEl.textContent = message;
  }
}
