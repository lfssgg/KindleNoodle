# Kindle Noodle：四页常亮实验版

基于 [lfssgg/KindleNoodle](https://github.com/lfssgg/KindleNoodle-1) 的网页副本，来源提交 `7fb3ef607731583129587db7d9e1a43a98dfefcc`。

这是纯静态网站，无需 Python、Node.js、数据库或后端 API。新增常亮功能使用相对资源路径，可部署在域名根目录或子目录。

网站保留四个功能页面：时钟、番茄钟、泡面计时、屏幕常亮。AI 日报和微信读书入口、页面、相关脚本及日报数据已移除。

## 使用常亮按钮

点击底部“常亮”进入第四页，再点“开启常亮”。随后可用“返回时钟”或底部导航切换到时钟，保持网站在前台。视频失败后，还可单独测试下文的旧浏览器导航实验：

- 支持标准 Screen Wake Lock API 的浏览器会尝试申请系统屏幕保活。
- 不支持该接口的浏览器会尝试播放本地无声视频。为兼容旧 WebKit，没有使用 async/await、箭头函数，也不要求旧版 video.play() 返回 Promise。
- “兼容保活运行中 · 待实测”仅表示视频时间在推进，不等于已经阻止设备休眠。必须在实际设备上静置至少 20 分钟，观察是否进入屏保、时钟是否仍更新。
- 接口被拒绝、媒体无法播放或播放中断时，会显示失败提示；不会把失败显示成“已启用”。
- 播放失败时可依次点击“改用 MP4 测试”和“MP4 内嵌测试”。前者绕过浏览器自动选择格式，后者还绕过视频 HTTP 请求与分段读取；二者仍要求设备能解码视频。失败后显示加载、网络及媒体错误状态，供排查使用。
- 点击“关闭常亮”、切后台、离开或刷新网页会释放保活。返回后需重新开启。页面内切换时钟、番茄钟等功能不会主动释放保活。
- 保活视频位于四个页面容器之外，切回时钟时不会因隐藏常亮页而隐藏视频。导航中的“常亮 · 开”表示系统接受了保活；“常亮 · 待验证”表示视频在播放，仍需实机验证。
- 已移除原项目每 12 小时整页自动刷新的设置，避免中断已启用的保活。时钟仍按原来的 JavaScript 定时器更新时间。

本版本尚未验证 Kindle X 咪咕、固件 5.7.2.8 的防休眠效果。若提示浏览器不支持，纯网页无法强行获得系统保活能力。

## 旧浏览器导航实验（不依赖视频）

在“常亮”页点击“旧浏览器保活实验（20 分钟）”，然后返回时钟。该模式每 15 秒导航到当前 URL（保留路径和查询参数、去除片段），并在下一个定时回调中调用 `window.stop()` 取消加载。参考 [NoSleep.js 对 iOS 10 以前版本的处理](https://github.com/richtr/NoSleep.js/blob/master/src/index.js)，这是向咪咕版迁移的待验证实验，没有证据保证有效。

- 不自动启动，也不与视频或标准保活同时运行；如正在运行其他模式，请先关闭。
- 默认 20 分钟后停止。导航计数、定时器执行或实验结束，都不代表屏幕没有休眠。请在不触摸设备的情况下观察至实验结束；触摸屏幕可能重置系统休眠计时，影响判断。
- 可以随时点击“停止实验”；离开页面、切后台或出现较长的脚本执行中断也会停止。不会模拟用户点击。
- 仅限时钟与常亮设置页；进入番茄钟或泡面计时页会停止实验。开始前请结束原有计时任务，因为实际重载可能丢失未保存的计时状态。
- 可能出现加载提示、闪屏或中断网络请求。如果取消加载没有赶上，整页可能重载；新页面不会自动重启实验。浏览器允许 sessionStorage 时，新页面会提示上次实验中断。
- 全部使用 ES5 语法和相对资源路径，仍可静态部署。设备能力诊断区分 `isSecureContext` 为 false 与接口不存在，避免把老浏览器的未知结果误判为确定不安全。

如果时钟停止或进入屏保，说明本轮实验未达到常亮目的；不能用“脚本还在执行”推断系统常亮。不要通过自动重复重启实验掩盖失败。

## GitHub → Cloudflare Pages

1. 将本文件所在目录的内容放到你的 GitHub 仓库，确保 `index.html` 位于仓库根目录。如果在原项目仓库上修改，至少同步 `index.html`、`keep-awake.js`、`keep-awake.css` 和整个 `awake-assets` 目录。
2. 在 Cloudflare Pages 导入这个 GitHub 仓库。
3. 框架预设选 `None`，构建命令填 `exit 0`，构建输出目录填 `.`。如果你保留了外层 `github-site/` 目录，则输出目录改为 `github-site`。
4. 部署完成后，检查首页和 `awake-assets/nosleep.mp4`、`awake-assets/nosleep.webm` 均能访问。

参考：[Cloudflare 静态 HTML 部署](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)。

标准保活接口通常要求安全上下文（HTTPS）。旧 Kindle 能打开局域网 HTTP，不代表能够打开部署后的 HTTPS 域名；页面访问兼容性与常亮能力需要分别验证。不要为了显示“成功”而把普通刷新或网络请求当作保活。

原项目的语录、时区查询仍保留其外部服务及原有回退逻辑。如果你在原仓库上更新，也应删除原来的 `data/` 日报目录，并停用仅用于日报生成的 GitHub Actions 工作流；本包不包含这些文件。

## 文件与来源

- `index.html`：四个页面及导航，包含独立常亮控制页与更新后的首次使用提示。
- `keep-awake.js`、`keep-awake.css`：常亮控制及样式。
- `awake-assets/nosleep.mp4`、`awake-assets/nosleep.webm`：来自 [NoSleep.js v0.12.0](https://github.com/richtr/NoSleep.js/tree/v0.12.0) 的测试媒体，许可见同目录 `LICENSE-NoSleep.txt`；来源及校验值见 `source.json`。
- `awake-assets/mp4-inline.js`：同一 MP4 的 Base64 版本，仅在用户点击“MP4 内嵌测试”后用于播放。不是新的编解码器，也无法绕过系统权限。
- `img/`、`debug.html`：保留的原项目资源。

技术参考：[Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)。
