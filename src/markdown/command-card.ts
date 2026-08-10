export const COMMAND_CARD_LANGUAGES = [
  "bash",
  "shell",
  "powershell",
  "python",
  "javascript",
  "typescript",
  "sql",
  "dockerfile",
  "yaml",
  "json",
  "text"
] as const;

export type CommandCardLanguage =
  typeof COMMAND_CARD_LANGUAGES[number];

export interface CommandCardInput {
  command: string;
  description: string;
  language: string;
  title: string;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function trimEmptyEdgeLines(value: string): string {
  const lines = normalizeLineEndings(value).split("\n");

  while (lines[0]?.trim() === "") {
    lines.shift();
  }
  while (lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}

function isCommandCardLanguage(value: string): value is CommandCardLanguage {
  return (COMMAND_CARD_LANGUAGES as readonly string[]).includes(value);
}

export function normalizeCommandCardInput(
  input: CommandCardInput
): CommandCardInput & { language: CommandCardLanguage } {
  const language = input.language.trim().toLowerCase();

  return {
    command: trimEmptyEdgeLines(input.command),
    description: trimEmptyEdgeLines(input.description),
    language: isCommandCardLanguage(language) ? language : "text",
    title: normalizeLineEndings(input.title).trim().replace(/\s+/g, " ")
  };
}

export function validateCommandCardInput(input: CommandCardInput): string | null {
  const normalized = normalizeCommandCardInput(input);

  if (!normalized.title) {
    return "Enter a title.";
  }
  if (!normalized.command.trim()) {
    return "Enter a command.";
  }

  return null;
}

function prefixCalloutLines(value: string): string[] {
  return value.split("\n").map((line) => `> ${line}`);
}

function commandFence(command: string): string {
  const longestRun = Math.max(
    0,
    ...Array.from(command.matchAll(/`+/g), (match) => match[0].length)
  );

  return "`".repeat(Math.max(3, longestRun + 1));
}

export function buildCommandCard(input: CommandCardInput): string {
  const validationError = validateCommandCardInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized = normalizeCommandCardInput(input);
  const fence = commandFence(normalized.command);
  const lines = [
    `> [!command] ${normalized.title}`,
    `> ${fence}${normalized.language}`,
    ...prefixCalloutLines(normalized.command),
    `> ${fence}`
  ];

  if (normalized.description) {
    lines.push(...prefixCalloutLines(normalized.description));
  }

  return lines.join("\n");
}

export function commandCardInsertionText(
  card: string,
  before: string,
  after: string
): string {
  const leading = before === "" ? "" : before.trim() ? "\n\n" : "\n";
  const trailing = after.trim() ? "\n\n" : "\n";

  return `${leading}${card}${trailing}`;
}
