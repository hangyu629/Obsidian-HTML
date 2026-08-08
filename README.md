# HTML Preview for Obsidian

Preview `.html` and `.htm` files stored in an Obsidian Vault. HTML remains an ordinary file: save it with any external tool, copy it and its asset folders into the Vault, then open it from Obsidian's file explorer.

## Features

- Opens HTML in normal Obsidian tabs, splits, and navigation history.
- Supports self-contained pages and folder-based CSS, JavaScript, images, fonts, audio, and video.
- Refreshes open previews when the HTML file or a known local dependency changes.
- Opens Vault-local links through Obsidian and web, email, or telephone links externally.
- Runs page JavaScript by default in a sandboxed iframe.
- Hides unwanted page regions with reversible file- or folder-scoped cleanup rules.
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
4. Select **Clean up page**, then point to and select an unwanted region. On touch devices, confirm with **Hide**.
5. Use **Undo cleanup** for the latest cleanup made in the current view, or **Manage cleanup rules** to restore, promote, or reset persistent rules.

## Enhanced Markdown Reading

Enhanced reading keeps the normal Markdown editor and source file intact. Use the **Enhanced reading** action from either Markdown source mode or native Markdown preview mode to open a rendered page. In enhanced reading, **Source** returns to Markdown source mode, **Preview** returns to native Markdown preview mode, and **Template & theme** changes the current template without splitting the page or opening another tab. Returning to source or preview keeps that native Markdown mode for the current note instead of immediately reopening enhanced reading. The renderer is Obsidian's native `MarkdownRenderer`, so core headings, lists, tables, tasks, callouts, code, math, links, embeds, Properties, and footnotes retain Obsidian behavior.

The built-in **Book Editorial** template is the default. It uses a book-like single-column layout, an editorial cover, paper-toned light and dark themes, and dedicated presentation for Properties, the table of contents, quotes, Callouts, tables, code, task lists, math, embeds, and footnotes. **Magazine Research** is also available as a built-in option: it uses a navy editorial masthead, coral and sage accents, a combined Contents/Properties band, and a wide research-report reading column.

Templates are Vault-backed packages under:

```text
.html-preview/markdown-templates/<template-id>/
  template.json
  layout.html
  styles.css
  themes/
  assets/
```

Layouts may define one each of `data-slot="title"`, `properties`, `toc`, and the required `data-slot="content"`. CSS is scoped to the enhanced view root. Template packages contain HTML, CSS, metadata, themes, and local assets only; scripts, forms, frames, external resources, and event-handler attributes are rejected.

Automatic enhanced reading is enabled in settings and applies only when a note matches a rule. In **Settings → Folder template mappings**, add a Vault folder and choose its template and theme from the selectors; nested notes inherit the mapping, with the most specific folder winning. A frontmatter rule has highest priority:

```yaml
html-preview:
  template: editorial
  theme: light
```

The equivalent flat keys are `html-preview.template` and `html-preview.theme`. When no frontmatter rule matches, the most specific configured folder mapping is used. Manual opening uses the configured default template and theme when no rule matches. Third-party Markdown processors continue to work through Obsidian's native renderer boundary; this plugin does not reimplement them.

## Page Cleanup

Cleanup changes only the preview DOM. The HTML file and its asset files are never edited. New rules apply to the current file by default. In **Manage cleanup rules**, a file rule can be promoted to its containing folder so it also applies to other HTML files under that folder.

Rules are stored inside the Vault:

```text
.html-preview/cleanup/pages/<HTML path>.json
.html-preview/cleanup/folder-rules.json
```

Renaming an HTML file migrates its file-scoped rules. Folder rules use path prefixes and are not automatically rewritten when an entire folder is renamed. Hidden Vault data syncs only when the selected sync provider includes hidden files.

Page cleanup requires **Allow page JavaScript** because rule replay and element selection run inside the isolated preview frame. Disabling that setting disables both replay and selection.

## Security

Page JavaScript is enabled by default. Pages run with `allow-scripts`, `allow-forms`, `allow-modals`, `allow-popups`, and `allow-downloads`, but without same-origin or top-navigation permission. They cannot directly access Obsidian's document, plugin API, Node.js, or Electron APIs.

Sandboxed scripts can still make network requests and disclose information already contained in the page. Disable **Allow page JavaScript** in plugin settings before opening HTML you do not trust.

## Compatibility Limits

The preview base is the HTML file's Vault folder. Standard relative resources work, including external stylesheets and classic scripts. Pages may behave differently if they require Service Workers, browser extensions, a local web server, Node/Electron APIs, privileged browser APIs, cross-origin exemptions, or dynamic resources that cannot be discovered statically. Use the manual reload action after changing a runtime-generated dependency. Cleanup can hide the outer element of a cross-origin iframe, canvas, video, or image, but cannot select content rendered inside it.

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
- 可在预览中隐藏侧栏、页脚、横幅等无用区域，不会修改 HTML 源文件。
- 同时支持桌面端、iOS 和 Android。
- 插件不会创建、编辑、下载或改写 HTML。

使用工具栏的 **Clean up page** 进入清理模式，选择不需要的区域；触屏设备需要再点 **Hide** 确认。**Undo cleanup** 只撤销当前视图会话中最近一次清理；在 **Manage cleanup rules** 中可以恢复单条规则、清空当前文件规则，或把文件规则提升为文件夹规则。

清理规则保存在 Vault 内的 `.html-preview/cleanup/`。默认规则只作用于当前 HTML；提升后的文件夹规则作用于该目录及子目录。重命名 HTML 文件时会迁移文件规则，但整目录重命名不会自动改写文件夹规则。同步工具是否同步这些数据，取决于它是否包含隐藏目录。

清理功能依赖 **Allow page JavaScript**；关闭此设置后不会应用规则，也不能选择元素。跨域 iframe、canvas、视频或图片内部的内容不能单独选择，只能隐藏它们的外层元素。

增强 Markdown 阅读不会改变 `.md` 源文件。源码模式和 Obsidian 原生预览模式都可以点击 **Enhanced reading** 进入增强阅读；进入后，右上角的 **Source**、**Preview** 可以直接切回对应模式，**Template & theme** 可以切换当前模板，不会分屏或新开标签。可以在设置中启用自动增强阅读、指定默认模板/主题，并在 **设置 → Folder template mappings** 中按 Vault 文件夹选择模板和主题；子文件夹继承规则，最具体的文件夹优先。frontmatter 优先于文件夹映射；没有匹配规则时，手动打开使用全局默认模板。模板只允许 HTML、CSS、主题和本地资源，不执行模板 JavaScript；Markdown 仍由 Obsidian 原生渲染器处理。

内置默认模板为 **Book Editorial**：它采用书籍式单栏、封面标题区和浅色/深色纸张主题，并专门处理 Properties、目录、引用、Callout、表格、代码、任务、数学公式、嵌入与脚注。

另一个内置模板为 **Magazine Research**：它采用深海军蓝刊头、珊瑚红与鼠尾草绿配色、目录与 Properties 信息带，以及适合长文研究报告的宽单栏正文。可以在增强阅读模板选择器中临时切换，也可以在文件夹映射中设置为自动应用。

首次使用前请阅读上面的 **Security** 与 **Compatibility Limits**。不信任的 HTML 可能通过脚本发起网络请求，可在插件设置中关闭 **Allow page JavaScript**。
