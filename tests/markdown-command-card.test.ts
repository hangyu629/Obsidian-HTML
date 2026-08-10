import { describe, expect, it } from "vitest";

import {
  buildCommandCard,
  COMMAND_CARD_LANGUAGES,
  commandCardInsertionText,
  normalizeCommandCardInput,
  validateCommandCardInput
} from "../src/markdown/command-card";

describe("command card Markdown", () => {
  it("builds a canonical single-line command callout", () => {
    expect(buildCommandCard({
      command: "git status",
      description: "Show the current working tree state.",
      language: "bash",
      title: "Check status"
    })).toBe([
      "> [!command] Check status",
      "> ```bash",
      "> git status",
      "> ```",
      "> Show the current working tree state."
    ].join("\n"));
  });

  it("prefixes every multiline command and description line", () => {
    const result = buildCommandCard({
      command: "git fetch origin\ngit rebase origin/main",
      description: "Fetch first.\nThen rebase.",
      language: "bash",
      title: "Sync branch"
    });

    expect(result).toContain("> git fetch origin\n> git rebase origin/main");
    expect(result).toContain("> Fetch first.\n> Then rebase.");
  });

  it("normalizes the title and language while omitting an empty description", () => {
    const normalized = normalizeCommandCardInput({
      command: "\r\npython app.py\r\n",
      description: "  ",
      language: "unsupported",
      title: "  Run\n  the app  "
    });

    expect(normalized).toEqual({
      command: "python app.py",
      description: "",
      language: "text",
      title: "Run the app"
    });
    expect(buildCommandCard(normalized)).toBe([
      "> [!command] Run the app",
      "> ```text",
      "> python app.py",
      "> ```"
    ].join("\n"));
    expect(COMMAND_CARD_LANGUAGES).toContain("powershell");
  });

  it("uses a fence longer than backtick runs inside the command", () => {
    const result = buildCommandCard({
      command: "printf '```'\nprintf '````'",
      description: "",
      language: "shell",
      title: "Print fences"
    });

    expect(result).toContain("> `````shell");
    expect(result.endsWith("> `````")).toBe(true);
  });

  it("validates title and command without rejecting valid whitespace inside commands", () => {
    expect(validateCommandCardInput({ command: "git status", description: "", language: "bash", title: "" }))
      .toBe("Enter a title.");
    expect(validateCommandCardInput({ command: "  \n ", description: "", language: "bash", title: "Status" }))
      .toBe("Enter a command.");
    expect(validateCommandCardInput({ command: "echo 'a b'", description: "", language: "bash", title: "Echo" }))
      .toBeNull();
  });

  it("adds block separation based on surrounding line text", () => {
    const card = "> [!command] Status\n> ```bash\n> git status\n> ```";

    expect(commandCardInsertionText(card, "", "")).toBe(`${card}\n`);
    expect(commandCardInsertionText(card, "Before", "After")).toBe(`\n\n${card}\n\n`);
    expect(commandCardInsertionText(card, "  ", "  ")).toBe(`\n${card}\n`);
  });
});
