# HTML Preview for Obsidian

Preview `.html` and `.htm` files stored in an Obsidian Vault. HTML remains an ordinary file: save it with any external tool, copy it and its asset folders into the Vault, then open it from Obsidian's file explorer.

## Features

- Opens HTML in normal Obsidian tabs, splits, and navigation history.
- Supports self-contained pages and folder-based CSS, JavaScript, images, fonts, audio, and video.
- Refreshes open previews when the HTML file or a known local dependency changes.
- Opens Vault-local links through Obsidian and web, email, or telephone links externally.
- Runs page JavaScript by default in a sandboxed iframe.
- Supports Obsidian Desktop, iOS, and Android without a local server or Electron-only APIs.
- Never changes the source HTML or its assets.

## Install From Source

Requirements: Node.js 20 or newer and a current Obsidian installation.

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<Vault>/.obsidian/plugins/html-preview/
```

Restart Obsidian, open **Settings -> Community plugins**, and enable **HTML Preview**.

## Use

1. Save an HTML file with another application.
2. Copy the HTML file and any asset folders into the Vault.
3. Select the HTML file in Obsidian's file explorer.
4. Use the view actions to reload, open outside Obsidian, or inspect compatibility diagnostics.

## Security

Page JavaScript is enabled by default. Pages run with `allow-scripts`, `allow-forms`, `allow-modals`, `allow-popups`, and `allow-downloads`, but without same-origin or top-navigation permission. They cannot directly access Obsidian's document, plugin API, Node.js, or Electron APIs.

Sandboxed scripts can still make network requests and disclose information already contained in the page. Disable **Allow page JavaScript** in plugin settings before opening HTML you do not trust.

## Compatibility Limits

The preview base is the HTML file's Vault folder. Standard relative resources work, including external stylesheets and classic scripts. Pages may behave differently if they require Service Workers, browser extensions, a local web server, Node/Electron APIs, privileged browser APIs, cross-origin exemptions, or dynamic resources that cannot be discovered statically. Use the manual reload action after changing a runtime-generated dependency.

## Development

```bash
npm test
npm run typecheck
npm run build
npm run validate
```

Fixtures for manual Vault smoke testing are in `tests/fixtures/`.

---

## 中文说明

本插件让 Obsidian 直接预览 Vault 内已有的 `.html` 和 `.htm` 文件。HTML 仍由外部工具保存；将文件及其资源目录复制到 Vault，然后在文件列表中点击即可。

- 支持单文件 HTML 和引用本地 CSS、JavaScript、图片、字体等资源的网页目录。
- 默认执行页面 JavaScript，但运行在不能访问 Obsidian、Node.js 或 Electron API 的隔离 iframe 中。
- HTML 或已识别的本地依赖变化时自动刷新。
- Vault 内链接由 Obsidian 打开，网络链接交给系统。
- 同时支持桌面端、iOS 和 Android。
- 插件不会创建、编辑、下载或改写 HTML。

首次使用前请阅读上面的 **Security** 与 **Compatibility Limits**。不信任的 HTML 可能通过脚本发起网络请求，可在插件设置中关闭 **Allow page JavaScript**。

