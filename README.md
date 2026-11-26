# MathIdiot · 数院旧主页复刻

为北京大学数学科学学院的院内门户提供老板预约界面的复刻，安装后使用自己的账号登录MathSmart网站即可。扩展仅在 `mathsmart.pku.edu.cn` 上运行，无需服务器，不保存或上传通知，也不读取账号凭据，本插件不会收集你的任何信息。

由于未保存旧页面快照，只能根据记忆进行复刻，如有同学愿意提供截图可以发送到issue页面。目前只复刻了我常会使用的部分功能，欢迎PR。

## 安装

两种安装方式功能相同，任选一种即可。

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

## 功能

- 查看通知
- 预约学生讨论室相关功能
- 查看教师名单
- 点击右上角可切回新版主页，也可以切换回来。

## 开发

直接修改 `portal.js` 和 `portal.css`，然后在 Chrome 重新加载扩展。运行 `node build-userscript.mjs` 可用同一份源码生成独立的 `math-portal.user.js`。MathSmart 更新页面结构时，通知选择器可能需要调整。

欢迎在 [GitHub Issues](https://github.com/nanomsj/mathidiot/issues) 反馈问题。

本项目使用 [MIT 许可证](LICENSE)。

页眉使用[学院英文官网提供的白色院徽与院名图](https://math-en.pku.edu.cn/images/logo.png)。

## 碎碎念

使用 chatgpt 6.2 Sol。由于本人对ai味浓厚的网页过敏而且不想每天打开页面看到一些无用的功能例如“综测”，因此用ai搓了一个自用的页面（我完全不会前端啊喂）。事实上只是自用，不过既然做了就在github上充个数好了（）

对了本人也没有追求完全一致，例如预约的日期选择之类的进行了创造性调整（bushi），做到看起来能接受就先这样好了w。
