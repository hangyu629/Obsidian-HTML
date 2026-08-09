# HTML Preview for Obsidian

一个面向 Obsidian 的 HTML 一等公民预览插件：把外部生成或保存的网页复制进 Vault 后，直接在 Obsidian 中打开、预览、清理和批注，不修改原始 HTML。

## 功能

- 直接打开 Vault 内的 `.html` 和 `.htm` 文件，并支持 Obsidian 标签页、分屏和导航历史。
- 解析同目录下的 CSS、JavaScript、图片、字体、音频和视频等相对资源。
- HTML 文件或已识别的本地依赖发生变化时自动刷新预览。
- 在隔离 iframe 中运行页面脚本，默认不允许访问 Obsidian、Node.js 或 Electron API。
- 清理页面中不需要的侧栏、页脚、横幅等区域；规则可按文件或文件夹保存，随时撤销或恢复。
- 在 HTML 预览和增强 Markdown 阅读中选择文字，添加五色高亮或批注。
- 在右侧“注释”侧栏中查看原文摘录、批注正文、仅高亮项目，并点击条目定位正文。
- 将 Markdown 交给 Obsidian 原生 `MarkdownRenderer` 渲染，再套用可配置的布局与主题模板。
- 支持全局默认模板、默认主题、按文件夹映射模板，以及 frontmatter 覆盖。
- 支持 Obsidian Desktop、iOS 和 Android；不需要本地服务器或 Electron 专用 API。

## 从源码安装

要求：Node.js 20+、Obsidian 1.5+。

```bash
npm install
npm run build
```

将以下文件复制到 Vault 的插件目录（目录名建议与 manifest ID 保持一致）：

```text
<Vault>/.obsidian/plugins/html-preview/
  main.js
  manifest.json
  styles.css
```

然后重启 Obsidian，进入 **设置 → 第三方插件**，启用 **HTML Preview**。

开发过程中可使用：

```bash
npm run dev       # 监听源码并生成开发构建
npm test          # 运行测试
npm run check     # 测试、类型检查、生产构建和发布校验
```

仓库会提交 Obsidian 所需的 `main.js`、`manifest.json` 和 `styles.css`；source map 与测试覆盖率目录不会提交。修改源码后运行 `npm run build`，确认构建产物更新后再推送。

## HTML 预览

1. 用外部工具保存 HTML 页面。
2. 将 HTML 文件和资源目录复制到 Vault。
3. 在 Obsidian 文件列表中打开 HTML 文件。
4. 使用右上角的 **Clean up page**，选择不需要的页面区域并隐藏。
5. 使用 **Undo cleanup** 撤销当前视图中的最近一次清理，或使用 **Manage cleanup rules** 管理规则、恢复规则、清空文件规则和提升为文件夹规则。
6. 在页面中选择文字，使用浮动的 **颜色** 或 **注释** 操作。点击已有高亮可以修改颜色、编辑批注或删除。
7. 从命令面板执行 **Open annotation sidebar**，在右侧查看并定位当前文件的批注。插件重新启用后会自动恢复该侧栏。

页面清理和 HTML 批注依赖设置中的 **Allow page JavaScript**。关闭后，HTML 页面仍可预览，但不会执行页面脚本、清理规则或 HTML 批注交互。

## 增强 Markdown 阅读

Markdown 文件仍然保留 Obsidian 原生源码和预览模式。点击 Markdown 视图右上角的 **Enhanced reading** 后，插件会使用 Obsidian 原生渲染器生成增强阅读页面；不会修改 `.md` 文件。

增强阅读页面提供：

- **Source**：返回 Markdown 源码模式。
- **Preview**：返回 Obsidian 原生预览模式。
- **Template & theme**：直接切换布局模板和主题，不分屏、不新开标签。
- 选择文字后添加颜色或批注；右侧注释栏可以查看并定位这些内容。

当前内置模板：

- **Book Editorial**：书籍式单栏布局、封面标题区、纸张风格的浅色/深色主题。
- **Magazine Research**：深海军蓝刊头、珊瑚红与鼠尾草绿点缀、目录与 Properties 信息带、宽单栏研究报告布局。

模板会覆盖标题、Properties、目录、正文、引用、Callout、表格、代码、任务、数学公式、嵌入和脚注等展示结构；Markdown 语法仍由 Obsidian 原生渲染器负责。

在 **设置 → Folder template mappings** 中为 Vault 文件夹选择模板和主题。子文件夹继承父级映射，最具体的文件夹优先。frontmatter 规则优先级最高：

```yaml
html-preview:
  template: book-editorial
  theme: light
```

也支持扁平写法：

```yaml
html-preview.template: magazine-research
html-preview.theme: dark
```

没有匹配规则时，手动打开增强阅读使用设置中的默认模板和主题。设置中的 **Open Markdown in Enhanced Preview by default** 可以控制是否自动进入增强阅读。

模板包保存在 Vault 中：

```text
.html-preview/markdown-templates/<template-id>/
  template.json
  layout.html
  styles.css
  themes/
  assets/
```

模板只允许 HTML、CSS、主题和本地资源；不执行模板 JavaScript，不允许外部资源、表单、frame 或事件处理器属性。

## 数据与同步

插件不会改写 HTML 或 Markdown 源文件。清理规则和批注保存在 Vault 隐藏目录：

```text
.html-preview/cleanup/pages/<HTML path>.json
.html-preview/cleanup/folder-rules.json
.html-preview/annotations/pages/<source path>.json
```

批注通过文本定位信息保存，包括摘录、前后文、起止位置和批注正文。源文档大幅改写后，条目可能显示“无法定位”；这时可以删除旧批注并重新添加。隐藏目录是否同步，取决于所使用的同步工具是否包含隐藏文件。

## 安全与兼容性

不信任的 HTML 可能通过脚本发起网络请求。页面运行在隔离 iframe 中，但脚本仍可能读取页面自身包含的数据并向网络发送请求。打开不可信页面前，请在设置中关闭 **Allow page JavaScript**。

预览基址是 HTML 文件所在的 Vault 文件夹。相对资源通常可以正常工作；依赖 Service Worker、本地服务器、Node/Electron API、浏览器扩展、跨域特权或运行时生成资源的页面可能表现不同。必要时使用右上角的 **Reload preview**。

## 项目结构

```text
src/main.ts                       插件入口、视图注册与工作区生命周期
src/html-preview-view.ts          HTML iframe 预览、清理和 HTML 批注
src/markdown/                     增强 Markdown 渲染、模板和主题
src/annotations/                  批注存储、浮动操作栏、运行时和右侧栏
src/cleanup/                      页面清理规则与清理运行时
src/preview/                      预览文档构建、依赖和导航
tests/                            Vitest 单元测试与集成测试
styles.css                       Obsidian 宿主界面样式
```

## License

当前仓库尚未声明开源许可证。推送到公开仓库前，请根据你的发布意图添加 `LICENSE` 文件，并在此处注明许可证名称。

## 中文快速上手

本插件让 Obsidian 直接预览 Vault 内已有的 HTML 页面。HTML 由外部工具生成和保存，再将 HTML 及资源目录复制到 Vault；插件只负责预览，不会修改源文件。

打开 HTML 后，可以用 **Clean up page** 隐藏无用区域，用 **Undo cleanup** 或 **Manage cleanup rules** 管理清理规则。选择页面文字后，会出现 **颜色** 和 **注释**；批注内容保存在 `.html-preview/annotations/`，不会写入 HTML。

打开 Markdown 文件后，可以点击 **Enhanced reading** 使用模板化的 HTML 阅读页面。源码、原生预览和增强阅读可以通过右上角按钮直接互相切换。增强阅读支持按文件夹选择模板和主题，也支持 frontmatter 覆盖。右侧“注释”栏会展示原文摘录和批注正文；插件重启后会自动恢复。
