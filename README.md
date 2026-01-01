# [YouTube] Outside-Player-Bar（Userscirpt）

## 简介：
- **背景**：将 `Outside-YouTube-Player-Bar` Chrome 扩展的核心功能移植为油猴脚本!
- **功能**：把 YouTube 播放器控制栏（进度条/按钮区）移到视频画面外侧。

## 安装

1. 安装 Violentmonkey 或其他用户脚本管理器。
2. 在脚本管理器中新建脚本，把 `[YouTube] Outside-Player-Bar.user.js` 全部内容粘贴进去并保存。
3. 打开任意 YouTube 视频页（`/watch` 或 `/<user>/live`）即可生效

## 使用

- 视频页右下角控制栏会注入一个切换按钮：
  - Tooltip 显示 `Inside player bar`：点击后切回“控制栏在视频内”模式。
  - Tooltip 显示 `Outside player bar`：点击后切回“控制栏在视频外”模式。
- 默认启用“Outside player bar”模式；开关状态会写入 `localStorage`（同一浏览器内持久化）。

## 备注

- YouTube 是 SPA，脚本会监听站内导航事件自动重新注入按钮/样式。
- 进入/退出全屏时会自动切换一次模式（与原扩展行为一致）。
