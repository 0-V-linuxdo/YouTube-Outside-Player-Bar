// ==UserScript==
// @name         [YouTube] Outside-Player-Bar [20260511] v1.0.2
// @namespace    https://github.com/0-V-linuxdo/YouTube-Outside-Player-Bar
// @license      MIT
// @description  Display YouTube's player bar outside the video.
//
// @version      [20260511] v1.0.2
// @update-log   [20260511] v1.0.2 - 按旧实现语义重做全屏控制栏常显，并修复脚本按钮初始下划线
//
// @match        https://*.youtube.com/*
// @match        https://youtube.com/*
//
// @run-at       document-start
// @grant        none
//
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAWJAAAFiQFtaJ36AAACy0lEQVR42u3b3ZGbMBhG4deZ3FIBDcgN0ABugAbcADRgCkANoAJEA2oAGqCBpQHuM0MBzkXGe5HJbPyXyQidUwGGZ/gksXswxlxFyfaNWwAAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAP87Y4yaplFRFDzVFAGcTifVdS3vvfq+V57nPN1UR0BZlhrHUU3TKMsynnKqa4C6rhVCUFVVPOlUF4F5nqvrOnnvWR+kvAsoikLee3Vdx/og5W1gVVUKIahpGp5+qucAWZaprmuN46iyLAGQanmeq+97ee9ljAFAqhVFoRCCuq5LbtsIgN/WB9M06Xw+AyDVsizT5XLROI5JbBsB8MX6wHsv7/2ut40AuGN9sOdjZQDcWV3XmqZpd8fKAHhwfdB1nUIIu1kfAOCJjDG7+ewMgBcqy/LzWDnW9QEA3jAWYv7sDIA3bhtvn51jehsA4B9sG4/HIwBSLYSgj4+PaK73O4/sPc3zLOec5nmO6roB8GLruso5pxBClNcPgBdyzsl7r23bov0NAHiiaZpkrdW6rtH/FgA80LIsstZGN+cB8GLbtqnvew3DsLvfBoC/NAyD+r6Pes4D4MltXdu2u5jzAHhwW9e27a7mPADunPO3131KAUC/jm+ttbud8wD4Ys5ba7UsS7L3IEkA67rKWqtpmpJ/+yUF4DbnYz++BcCTc945t/ttHQD+MOdj/EwLgDe87q210X6mBcAL7eEzLQAezHv/OeuZ8/d3MMZcuQ3pxh+FAoAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgAFBEHa7XK/8dzBuAAEAAIAAQAAgABAACAAGA9t7hh8RJIG8AAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAAKCY+wnlPORj5a0IYQAAAABJRU5ErkJggg==
// ==/UserScript==

// ================================================
// 原插件信息：
// 名称：Outside-YouTube-Player-Bar
// 作者：1natsu172
// 链接：https://github.com/1natsu172/Outside-YouTube-Player-Bar/releases/tag/v3.0.10
// 版本：3.0.10
// ================================================

(() => {
  'use strict'

  const SCRIPT = {
    styleId: 'oypb-userscript-style',
    buttonId: 'oypb-toggleExtension',
    storageKey: 'oypb:outsideEnabled',
  }

  const CLASS = {
    isVisiblePlayerBar: 'oypb-is-visible-playerBar',
    isOutsidePlayerBar: 'oypb-is-outside-playerBar',
    isFullscreen: 'oypb-is-fullscreen',
  }

  const TOOLTIP_TEXT = {
    whenOutside: 'Inside player bar',
    whenInside: 'Outside player bar',
  }

  const VIDEO_PRESENTATION_EVENTS = [
    'webkitbeginfullscreen',
    'webkitendfullscreen',
    'webkitpresentationmodechanged',
  ]

  const FULLSCREEN_EVENTS = [
    'fullscreenchange',
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'MSFullscreenChange',
    ...VIDEO_PRESENTATION_EVENTS,
    'resize',
    'orientationchange',
  ]

  const state = {
    outsideEnabled: true,
    fullscreenActive: false,
    playerObserver: null,
    resizeObserver: null,
    fullscreenObserver: null,
    videoPresentationElement: null,
    videoPresentationHandler: null,
    syncToken: 0,
    queued: false,
    fullscreenQueued: false,
  }

  const readStoredOutsideEnabled = () => {
    try {
      const raw = localStorage.getItem(SCRIPT.storageKey)
      if (raw === null) return true
      return raw === 'true'
    } catch {
      return true
    }
  }

  const writeStoredOutsideEnabled = (value) => {
    try {
      localStorage.setItem(SCRIPT.storageKey, String(value))
    } catch {
      // ignore
    }
  }

  const isVideoPage = () => {
    const pathName = location.pathname
    const userLivePagePathnamePattern = /^\/@?[^/]+\/live$/
    return pathName === '/watch' || userLivePagePathnamePattern.test(pathName)
  }

  const ensureStyle = () => {
    if (document.getElementById(SCRIPT.styleId)) return
    const style = document.createElement('style')
    style.id = SCRIPT.styleId
    style.textContent = `
:root{
  --oypb-player-bar-height: 51px;
  --oypb-player-bar-fill-lr-gap-size: 12px;
  --oypb-player-bar-color: rgb(15, 15, 15);
  --oypb-transition-in: .25s cubic-bezier(0.0, 0.0, 0.2, 1);
  --oypb-transition-out: 0s cubic-bezier(0.4, 0.0, 1, 1);
}
:root .oypb-is-fullscreen{
  --oypb-player-bar-height: 58px;
  --oypb-player-bar-fill-lr-gap-size: 24px;
  --oypb-player-ytp-chrome-top: 63px;
}
:root[dark]{
  --oypb-player-bar-color: var(--yt-spec-base-background, rgb(15, 15, 15));
}
.oypb-is-none{display:none !important;}
.oypb-toggleExtensionButton{
  position:relative !important;
  text-align:center !important;
  vertical-align:top;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  line-height:0 !important;
  align-self:center !important;
  overflow:visible !important;
  border:0 !important;
  outline:0 !important;
  box-shadow:none !important;
  text-decoration:none !important;
  background-image:none !important;
  -webkit-appearance:none !important;
  appearance:none !important;
  font-size:0 !important;
}
.oypb-toggleExtensionButton::before,
.oypb-toggleExtensionButton::after{
  content:none !important;
  display:none !important;
  border:0 !important;
  outline:0 !important;
  box-shadow:none !important;
  background:none !important;
}
.oypb-toggleExtensionButton:focus,
.oypb-toggleExtensionButton:focus-visible,
.oypb-toggleExtensionButton:active{
  border:0 !important;
  outline:0 !important;
  box-shadow:none !important;
  text-decoration:none !important;
}
.oypb-toggleExtensionButton>svg{
  vertical-align:middle;
  display:block;
  width:18px;
  height:16px;
  transition:none !important;
  pointer-events:none;
}
.oypb-is-fullscreen .oypb-toggleExtensionButton>svg{
  width:25px;
  height:22.222px;
}
.oypb-tooltip{
  position:relative;
  overflow:visible;
  transition:opacity .1s cubic-bezier(0.4,0.0,1,1);
}
.oypb-tooltipText{
  position:absolute;
  top:-38px;
  left:50%;
  transform:translateX(-50%);
  white-space:nowrap;
  display:block;
  background-color:rgba(28,28,28,0.9);
  border-radius:2px;
  padding:5px 9px;
  color:#fff;
  font-size:12.98px;
  font-weight:500;
  line-height:15px;
  pointer-events:none;
  opacity:0;
  transition:opacity .1s cubic-bezier(0.4,0.0,1,1);
}
.oypb-tooltip:hover .oypb-tooltipText{
  opacity:1;
}

.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} #primary{
  transition:opacity var(--oypb-transition-in), transform var(--oypb-transition-in) !important;
}
.${CLASS.isOutsidePlayerBar} #primary{
  transform:translate3d(0, var(--oypb-player-bar-height), 0);
  transition:opacity var(--oypb-transition-out), transform var(--oypb-transition-out) !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} #columns{overflow-y:hidden;}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} #player{
  transition:opacity var(--oypb-transition-in), transform var(--oypb-transition-in) !important;
}
.${CLASS.isOutsidePlayerBar} #player{
  transform:translate3d(0, calc(-1 * var(--oypb-player-bar-height)), 0);
  transition:opacity var(--oypb-transition-out), transform var(--oypb-transition-out) !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .html5-video-player{
  overflow:visible;
  contain:size style layout;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} #player-container-outer,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} #player-container-inner,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} #player-container,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} #ytd-player.ytd-watch-flexy,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .html5-video-container{
  overflow:visible !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} ytd-watch-flexy[rounded-player-large][default-layout] #ytd-player.ytd-watch-flexy{
  overflow:visible;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-chrome-bottom{
  background-color:var(--oypb-player-bar-color);
  transition:opacity var(--oypb-transition-in), transform var(--oypb-transition-in) !important;
}
.${CLASS.isOutsidePlayerBar} .ytp-chrome-bottom{
  transform:translate3d(0, var(--oypb-player-bar-height), 0);
  transition:opacity var(--oypb-transition-out), transform var(--oypb-transition-out) !important;
}
.${CLASS.isOutsidePlayerBar} #movie_player .ytp-chrome-bottom,
.${CLASS.isOutsidePlayerBar} #movie_player .ytp-chrome-bottom .ytp-chrome-controls{
  opacity:1 !important;
  visibility:visible !important;
  pointer-events:auto !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} #primary,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} #player,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} #secondary,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-chrome-bottom,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-tooltip,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-settings-menu,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .caption-window.ytp-caption-window-bottom{
  transform:none !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-chrome-bottom .ytp-left-controls::before,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-chrome-bottom .ytp-right-controls::after{
  content:'';
  display:block;
  height:100%;
  width:var(--oypb-player-bar-fill-lr-gap-size);
  position:absolute;
  top:0;
  background-color:var(--oypb-player-bar-color);
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-chrome-bottom .ytp-left-controls::before{
  left:calc(-1 * var(--oypb-player-bar-fill-lr-gap-size));
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-chrome-bottom .ytp-right-controls::after{
  right:calc(-1 * var(--oypb-player-bar-fill-lr-gap-size));
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .oypb-toggleExtensionButton>svg{
  transform:rotateX(180deg);
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ended-mode .html5-main-video{
  visibility:hidden !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-iv-player-content{bottom:12px;}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-tooltip{
  transform:translate3d(0, var(--oypb-player-bar-height), 0) !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .caption-window.ytp-caption-window-bottom{
  transform:translate3d(0, var(--oypb-player-bar-height), 0);
  transition:opacity var(--oypb-transition-in), transform var(--oypb-transition-in) !important;
}
.${CLASS.isOutsidePlayerBar} .caption-window.ytp-caption-window-bottom{
  transition:opacity var(--oypb-transition-out), transform var(--oypb-transition-out) !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-settings-menu{
  transform:translate3d(0, var(--oypb-player-bar-height), 0);
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} .ytp-gradient-bottom{display:none;}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-chrome-bottom{
  background-color:transparent !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-gradient-bottom{
  display:block !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-chrome-bottom .ytp-left-controls::before,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-chrome-bottom .ytp-right-controls::after{
  display:none !important;
  background-color:transparent !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} ytd-watch-flexy[theater] #secondary,
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar} ytd-watch-flexy[fullscreen] #secondary{
  transform:translate3d(0, var(--oypb-player-bar-height), 0);
  transition:opacity var(--oypb-transition-in), transform var(--oypb-transition-in) !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} #secondary{
  transform:none !important;
}
.${CLASS.isOutsidePlayerBar} #secondary{
  transition:opacity var(--oypb-transition-out), transform var(--oypb-transition-out) !important;
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-chrome-top{
  transform:translateY(calc(-1 * var(--oypb-player-ytp-chrome-top)));
}
.${CLASS.isOutsidePlayerBar}.${CLASS.isVisiblePlayerBar}.${CLASS.isFullscreen} .ytp-big-mode .ytp-gradient-top{
  display:none;
}
    `.trim()
    ;(document.head || document.documentElement).appendChild(style)
  }

  const waitForElement = (selector, { root = document, timeoutMs = 30_000 } = {}) =>
    new Promise((resolve, reject) => {
      const found = root.querySelector(selector)
      if (found) return resolve(found)

      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector)
        if (!el) return
        observer.disconnect()
        resolve(el)
      })
      observer.observe(root, { childList: true, subtree: true })

      if (timeoutMs <= 0) return
      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`Timeout waiting for ${selector}`))
      }, timeoutMs)
    })

  const setOutsideEnabled = (enabled) => {
    state.outsideEnabled = enabled
    writeStoredOutsideEnabled(enabled)
    const body = document.body
    if (!body) return
    body.classList.toggle(CLASS.isOutsidePlayerBar, enabled)
    updateButtonTooltip()
    if (enabled) wakeControls()
  }

  const updateButtonTooltip = () => {
    const button = document.getElementById(SCRIPT.buttonId)
    if (!button) return
    const tooltipText = state.outsideEnabled
      ? TOOLTIP_TEXT.whenOutside
      : TOOLTIP_TEXT.whenInside
    button.setAttribute('aria-label', tooltipText)
    button.setAttribute('data-oypb-tooltip', tooltipText)
    const tooltip = button.querySelector('.oypb-tooltipText')
    if (tooltip) tooltip.textContent = tooltipText
  }

  const injectButton = async (token) => {
    const existing = document.getElementById(SCRIPT.buttonId)
    if (existing) {
      updateButtonTooltip()
      return
    }

    const playerBar = await waitForElement('.ytp-chrome-bottom').catch(() => null)
    if (!playerBar || token !== state.syncToken) return

    const rightControls = await waitForElement('.ytp-right-controls', {
      root: playerBar,
      timeoutMs: 10_000,
    }).catch(() => null)
    if (!rightControls) return

    const button = document.createElement('button')
    button.id = SCRIPT.buttonId
    button.type = 'button'
    button.className = 'ytp-button oypb-toggleExtensionButton oypb-tooltip'
    button.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 18 16">
  <path id="oypb-toggle" fill="#fff" d="M0 0h18v5H0zm6.78 5v5.39H3.39L9 16l5.61-5.61h-3.39V5H6.78z"/>
</svg>
<span class="oypb-tooltipText" aria-hidden="true"></span>`.trim()

    button.addEventListener(
      'click',
      () => {
        setOutsideEnabled(!state.outsideEnabled)
      },
      { passive: true },
    )

    rightControls.insertAdjacentElement('afterbegin', button)
    updateButtonTooltip()
    requestAnimationFrame(() => button.blur())
  }

  const removeButton = () => {
    const button = document.getElementById(SCRIPT.buttonId)
    if (button) button.remove()
  }

  const blockAutohide = (moviePlayer) => {
    try {
      moviePlayer.dispatchEvent(new Event('mouseover'))
      moviePlayer.dispatchEvent(new Event('mousemove'))
      moviePlayer.dispatchEvent(new Event('mousedown'))
      moviePlayer.dispatchEvent(new Event('mouseleave'))
    } catch {
      // ignore
    }
  }

  const wakeControls = () => {
    const moviePlayer = document.querySelector('#movie_player')
    if (moviePlayer) blockAutohide(moviePlayer)
  }

  const isVideoPresentationFullscreen = () =>
    [...document.querySelectorAll('video')].some(
      (video) =>
        video.webkitDisplayingFullscreen ||
        video.webkitPresentationMode === 'fullscreen',
    )

  const isFullscreenLikeActive = () =>
    Boolean(
      document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        document.querySelector('ytd-watch-flexy[fullscreen]') ||
        document.querySelector('#movie_player.ytp-fullscreen') ||
        document.querySelector('.html5-video-player.ytp-fullscreen') ||
        isVideoPresentationFullscreen(),
    )

  const applyFullscreenState = (isFullscreen) => {
    const body = document.body
    if (!body) return

    state.fullscreenActive = isFullscreen
    body.classList.toggle(CLASS.isFullscreen, isFullscreen)
    body.classList.toggle(CLASS.isOutsidePlayerBar, state.outsideEnabled)

    if (state.outsideEnabled) wakeControls()
  }

  const updateFullscreenState = ({ force = false } = {}) => {
    const next = isVideoPage() && isFullscreenLikeActive()
    if (!force && next === state.fullscreenActive) return

    applyFullscreenState(next)
  }

  const queueFullscreenStateUpdate = (options) => {
    if (state.fullscreenQueued) return
    state.fullscreenQueued = true

    const run = () => {
      state.fullscreenQueued = false
      updateFullscreenState(options)
    }

    if ('requestAnimationFrame' in window) {
      requestAnimationFrame(run)
    } else {
      setTimeout(run, 0)
    }
  }

  const attachFullscreenMarkerObserver = (moviePlayer) => {
    if (state.fullscreenObserver) state.fullscreenObserver.disconnect()

    const observer = new MutationObserver(() => queueFullscreenStateUpdate())
    ;[
      document.documentElement,
      document.body,
      document.querySelector('ytd-watch-flexy'),
      moviePlayer,
    ]
      .filter(Boolean)
      .forEach((element) => {
        observer.observe(element, {
          attributes: true,
          attributeFilter: ['class', 'fullscreen'],
        })
      })

    state.fullscreenObserver = observer
  }

  const detachVideoPresentationHooks = () => {
    const video = state.videoPresentationElement
    const handler = state.videoPresentationHandler
    if (video && handler) {
      VIDEO_PRESENTATION_EVENTS.forEach((eventName) => {
        video.removeEventListener(eventName, handler, true)
      })
    }
    state.videoPresentationElement = null
    state.videoPresentationHandler = null
  }

  const attachVideoPresentationHooks = (moviePlayer) => {
    const video = moviePlayer.querySelector('video') || document.querySelector('video')
    if (!video || typeof video.addEventListener !== 'function') return
    if (state.videoPresentationElement === video) return

    detachVideoPresentationHooks()

    const handler = () => queueFullscreenStateUpdate()
    VIDEO_PRESENTATION_EVENTS.forEach((eventName) => {
      video.addEventListener(eventName, handler, true)
    })
    state.videoPresentationElement = video
    state.videoPresentationHandler = handler
  }

  const attachPlayerObserver = (moviePlayer) => {
    if (state.playerObserver) state.playerObserver.disconnect()

    const observer = new MutationObserver(() => {
      if (!state.outsideEnabled) return
      if (!document.body?.classList.contains(CLASS.isOutsidePlayerBar)) return

      const classList = moviePlayer.classList
      const isVisiblePlayerBar =
        classList.contains('paused-mode') || !classList.contains('ytp-autohide')

      if (!isVisiblePlayerBar) blockAutohide(moviePlayer)
    })

    observer.observe(moviePlayer, { attributes: true, attributeFilter: ['class'] })
    state.playerObserver = observer

    if (state.outsideEnabled) blockAutohide(moviePlayer)
  }

  const attachResizeObserver = (playerBarContainer) => {
    if (state.resizeObserver) state.resizeObserver.disconnect()
    if (!('ResizeObserver' in window)) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const size = entry.borderBoxSize?.[0]
        const height =
          size?.blockSize != null
            ? `${size.blockSize}px`
            : `${playerBarContainer.getBoundingClientRect().height}px`
        if (!height || height === '0px') continue
        document.documentElement.style.setProperty('--oypb-player-bar-height', height)
      }
    })
    ro.observe(playerBarContainer, { box: 'border-box' })
    state.resizeObserver = ro
  }

  const activate = async (token) => {
    const body = await waitForElement('body', {
      root: document.documentElement,
      timeoutMs: 30_000,
    }).catch(() => null)
    if (!body || token !== state.syncToken) return

    ensureStyle()

    body.classList.add(CLASS.isVisiblePlayerBar)
    body.classList.toggle(CLASS.isOutsidePlayerBar, state.outsideEnabled)

    const moviePlayer = await waitForElement('#movie_player').catch(() => null)
    if (!moviePlayer || token !== state.syncToken) return

    const playerBarContainer = await waitForElement('.ytp-chrome-bottom').catch(
      () => null,
    )
    if (!playerBarContainer || token !== state.syncToken) return

    attachFullscreenMarkerObserver(moviePlayer)
    attachVideoPresentationHooks(moviePlayer)
    attachPlayerObserver(moviePlayer)
    attachResizeObserver(playerBarContainer)
    updateFullscreenState({ force: true })
    await injectButton(token)
  }

  const deactivate = () => {
    if (state.playerObserver) state.playerObserver.disconnect()
    if (state.resizeObserver) state.resizeObserver.disconnect()
    if (state.fullscreenObserver) state.fullscreenObserver.disconnect()
    detachVideoPresentationHooks()
    state.playerObserver = null
    state.resizeObserver = null
    state.fullscreenObserver = null
    state.fullscreenActive = false

    removeButton()
    document.body?.classList.remove(
      CLASS.isVisiblePlayerBar,
      CLASS.isOutsidePlayerBar,
      CLASS.isFullscreen,
    )
  }

  const sync = async () => {
    const token = ++state.syncToken
    if (isVideoPage()) {
      await activate(token)
    } else {
      deactivate()
    }
  }

  const queueSync = () => {
    if (state.queued) return
    state.queued = true
    queueMicrotask(async () => {
      state.queued = false
      await sync()
    })
  }

  const installNavigationHooks = () => {
    ;['yt-navigate-finish', 'yt-page-data-updated', 'yt-player-updated'].forEach(
      (eventName) => {
        document.addEventListener(eventName, queueSync, true)
      },
    )

    const pushState = history.pushState
    history.pushState = function (...args) {
      const ret = pushState.apply(this, args)
      queueSync()
      return ret
    }

    const replaceState = history.replaceState
    history.replaceState = function (...args) {
      const ret = replaceState.apply(this, args)
      queueSync()
      return ret
    }

    window.addEventListener('popstate', queueSync, true)
  }

  const installFullscreenHook = () => {
    FULLSCREEN_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, queueFullscreenStateUpdate, true)
      document.addEventListener(eventName, queueFullscreenStateUpdate, true)
    })
  }

  state.outsideEnabled = readStoredOutsideEnabled()
  installNavigationHooks()
  installFullscreenHook()
  queueSync()
})()
