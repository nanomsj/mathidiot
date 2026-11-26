# MathIdiot · 数院四栏通知

为北大数学科学学院的 MathSmart 提供四宫格通知、正文阅读和讨论室预约界面。使用自己的账号登录 MathSmart 即可。

## 安装

两种安装方式共用同版本的 JavaScript、CSS 和院徽图片，通知和预约功能相同。任选一种即可；切换安装方式时，请先禁用另一版。

### 方式一：Tampermonkey（篡改猴）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。Chrome 若有「允许运行用户脚本」开关，在 Tampermonkey 的扩展详情中将其打开。旧版 Chrome 可参照 [Tampermonkey 官方说明](https://www.tampermonkey.net/faq.php#Q209)开启开发者模式。
2. 点击[安装 `math-portal.user.js`](https://github.com/nanomsj/mathidiot/releases/latest/download/math-portal.user.js)，在安装确认页点「安装」。
3. 如果浏览器直接下载了文件，打开 Tampermonkey 管理面板的「实用工具」，在「从文件导入」处选择下载的 `.user.js` 文件并确认安装。
4. 登录并刷新 [MathSmart](https://mathsmart.pku.edu.cn/schedule)。

Tampermonkey 会按自己的更新周期检查版本，自动更新可能有延迟。需要马上更新时，再打开上面的脚本链接安装最新版。

### 方式二：Chrome 扩展 ZIP

1. 下载并解压 [mathidiot-chrome.zip](https://github.com/nanomsj/mathidiot/releases/latest/download/mathidiot-chrome.zip)。也可以在仓库首页点击「Code → Download ZIP」，解压源码。
2. 在 Chrome 地址栏输入 `chrome://extensions/`，打开「开发者模式」。
3. 点击「加载未打包的扩展程序」，选择包含 `manifest.json` 的文件夹。
4. 登录并刷新 [MathSmart](https://mathsmart.pku.edu.cn/schedule)。

更新时，下载新版 ZIP 并将文件解压到原扩展文件夹，在扩展管理页点「重新加载」，再刷新 MathSmart。

## 使用

- 点击通知标题打开四栏版的正文页。点击「查看全部」打开对应栏目列表。
- 点「MathSmart 原版」在当前标签页恢复官方界面。点右侧「回到四栏版」书签切回来，也可以用 Chrome 或 Tampermonkey 菜单里的「打开数院四栏版」。
- 「学院制度及规定」链接到旧门户留档。其余三栏显示 MathSmart 首页已有的通知。
- 「常用服务」中的「讨论室预约」先选择房间和日期，再显示单日时段表。蓝色标记本人预约，红色标记其他已占用时段。底部预约信息表单沿用 MathSmart 的字段和提交规则。
- 教室借用和学院教师名录仍可从「常用服务」进入。预约资格由 MathSmart 决定。

这是学生可自行安装的第三方扩展。扩展仅在 `mathsmart.pku.edu.cn` 上运行，无需服务器，不保存或上传通知，也不读取账号凭据。

## 开发

直接修改 `portal.js` 和 `portal.css`，然后在 Chrome 重新加载扩展。运行 `node build-userscript.mjs` 可用同一份源码生成独立的 `math-portal.user.js`。MathSmart 更新页面结构时，通知选择器可能需要调整。

欢迎在 [GitHub Issues](https://github.com/nanomsj/mathidiot/issues) 反馈问题。建议附上浏览器版本、扩展版本和复现步骤。

本项目使用 [MIT 许可证](LICENSE)。

页眉使用[学院英文官网提供的白色院徽与院名图](https://math-en.pku.edu.cn/images/logo.png)。
