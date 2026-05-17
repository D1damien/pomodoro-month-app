# 番茄钟月记录

一个可在 Windows 浏览器和 iPhone 主屏幕使用的 PWA 初稿。

## iPhone 自用方案

不需要 Apple Developer，不需要 App Store 上架。

推荐部署为 HTTPS 静态网页，例如 GitHub Pages。iPhone 打开网址后，在 Safari 里点分享按钮，选择“添加到主屏幕”。

## 本地预览

Windows 双击 `start-server.cmd`，保持窗口打开。电脑访问窗口里的 `Windows` 地址，iPhone 和电脑在同一个 Wi-Fi 下访问窗口里的 `iPhone` 地址。

## 已包含功能

- 番茄钟开始、暂停、重置
- 月历统计
- 点日期后可对选中日期快捷打卡
- 每点一次“快捷打卡”增加 15 分钟，也就是 0.25H
- 浏览器本地保存记录
