import './style.css'
import { DEVICES, CATEGORIES, SKINS, BROWSERS, LOCK_ICON_PATH, browserLogoHTML } from './data.js'
import { captureScreenshot, startRecording, downloadBlob, captureSupported, recordingSupported } from './capture.js'
import { attachDragScroll } from './touch.js'

const $ = (sel, ctx = document) => ctx.querySelector(sel)
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel))

const SAVED_KEY = 'mp-saved-configs'
const THEME_KEY = 'mp-theme'

const state = {
  tab: 'devices', // devices | skins | saved
  category: 'All',
  deviceId: 'iphone-17-pro-max',
  skinId: 'space-black',
  browserId: 'safari',
  zoom: 100,
  browserMenuOpen: false,
  currentUrl: '',
  rotated: false,
  dragScroll: true,
  saved: loadSaved(),
}

let loadStallTimer = null
let dragHandle = null
let recorder = null

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) ?? []
  } catch {
    return []
  }
}
function persistSaved() {
  localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved))
}

const getBaseDevice = () => DEVICES.find((d) => d.id === state.deviceId) ?? DEVICES[0]

/** The active device, with width/height swapped when rotated. */
function getDevice() {
  const base = getBaseDevice()
  if (!state.rotated) return base
  return {
    ...base,
    vw: base.vh,
    vh: base.vw,
    orientation: base.orientation === 'landscape' ? 'portrait' : 'landscape',
    rotated: true,
  }
}

const getSkin = () => SKINS.find((s) => s.id === state.skinId) ?? SKINS[0]
const getBrowser = () => BROWSERS.find((b) => b.id === state.browserId) ?? BROWSERS[0]

/* ------------------------------------------------------------------ */
/*  Toasts                                                             */
/* ------------------------------------------------------------------ */

const TOAST_TONES = {
  info: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
}

function toast(message, tone = 'info', ms = 3800) {
  const host = $('#toasts')
  if (!host) return
  const el = document.createElement('div')
  el.className = `pointer-events-auto max-w-sm rounded-xl px-3.5 py-2 text-xs font-medium shadow-lg transition-all duration-200 ${TOAST_TONES[tone] ?? TOAST_TONES.info}`
  el.style.opacity = '0'
  el.style.transform = 'translateY(6px)'
  el.textContent = message
  host.appendChild(el)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(6px)'
    setTimeout(() => el.remove(), 220)
  }, ms)
}

const els = {}

function cacheEls() {
  els.tabs = $$('.sidebar-tab')
  els.panels = {
    devices: $('#panel-devices'),
    skins: $('#panel-skins'),
    saved: $('#panel-saved'),
  }
  els.categoryPills = $('#category-pills')
  els.deviceList = $('#device-list')
  els.skinGrid = $('#skin-grid')
  els.savedList = $('#saved-list')
  els.saveConfigBtn = $('#save-config-btn')

  els.browserBtn = $('#browser-btn')
  els.browserMenu = $('#browser-menu')
  els.browserDot = $('#browser-current-dot')
  els.browserLabel = $('#browser-current-label')

  els.zoomOut = $('#zoom-out')
  els.zoomIn = $('#zoom-in')
  els.zoomLabel = $('#zoom-label')

  els.reloadBtn = $('#reload-btn')
  els.reloadIcon = $('#reload-icon')
  els.fullscreenBtn = $('#fullscreen-btn')
  els.themeToggle = $('#theme-toggle')

  els.urlInput = $('#url-input')
  els.goBtn = $('#go-btn')

  els.canvasArea = $('#canvas-area')
  els.deviceStage = $('#device-stage')
  els.deviceFrame = $('#device-frame')
  els.deviceLabel = $('#device-label')
}

/* ------------------------------------------------------------------ */
/*  Device frame rendering                                             */
/* ------------------------------------------------------------------ */

// Every dimension below is expressed in REAL device pixels. The whole frame
// is scaled as a single unit at render time, so these never need adjusting
// per zoom level.

function cutoutHTML(device) {
  // Rotating the handset moves the camera housing to what is now the left edge.
  const rot = device.rotated
  switch (device.cutout) {
    case 'island':
      return rot
        ? `<div class="absolute top-1/2 -translate-y-1/2 rounded-full bg-black" style="left:14px;width:37px;height:125px;"></div>`
        : `<div class="absolute left-1/2 -translate-x-1/2 rounded-full bg-black" style="top:14px;width:125px;height:37px;"></div>`
    case 'punch-center':
      return rot
        ? `<div class="absolute top-1/2 -translate-y-1/2 rounded-full bg-black" style="left:14px;width:13px;height:13px;box-shadow:0 0 0 2px rgba(0,0,0,.45);"></div>`
        : `<div class="absolute left-1/2 -translate-x-1/2 rounded-full bg-black" style="top:14px;width:13px;height:13px;box-shadow:0 0 0 2px rgba(0,0,0,.45);"></div>`
    case 'punch-corner':
      return rot
        ? `<div class="absolute rounded-full bg-black" style="bottom:26px;left:16px;width:13px;height:13px;box-shadow:0 0 0 2px rgba(0,0,0,.45);"></div>`
        : `<div class="absolute rounded-full bg-black" style="top:16px;right:26px;width:13px;height:13px;box-shadow:0 0 0 2px rgba(0,0,0,.45);"></div>`
    case 'home': {
      // Speaker + camera sit in the bezel band; the Touch ID button sits in
      // the thick chin — both outside the screen area. Rotating the handset
      // moves that chin (and the button) to the right-hand edge.
      const chin = device.chin ?? device.bezel
      const earOffset = Math.round(device.bezel / 2 + 3)
      const btnOffset = Math.round(chin / 2 + 26)
      if (rot) {
        return `
          <div class="absolute top-1/2 flex -translate-y-1/2 flex-col items-center" style="left:-${earOffset}px;gap:10px;">
            <span class="rounded-full bg-black/40" style="width:5px;height:56px;"></span>
            <span class="rounded-full bg-black/40" style="width:7px;height:7px;"></span>
          </div>
          <div class="absolute top-1/2 -translate-y-1/2 rounded-full" style="right:-${btnOffset}px;width:52px;height:52px;border:3px solid rgba(0,0,0,.45);"></div>
        `
      }
      return `
        <div class="absolute left-1/2 flex -translate-x-1/2 items-center" style="top:-${earOffset}px;gap:10px;">
          <span class="rounded-full bg-black/40" style="width:56px;height:5px;"></span>
          <span class="rounded-full bg-black/40" style="width:7px;height:7px;"></span>
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 rounded-full" style="bottom:-${btnOffset}px;width:52px;height:52px;border:3px solid rgba(0,0,0,.45);"></div>
      `
    }
    default:
      return ''
  }
}

function homeIndicatorHTML(device) {
  if (device.cutout === 'home') return '' // physical home button already present
  const w = device.orientation === 'landscape' ? 320 : 140
  return `<div class="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 dark:bg-white/80" style="bottom:8px;width:${w}px;height:5px;"></div>`
}

function curvedEdgeHTML() {
  return `
    <div class="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-black/25 to-transparent" style="width:16px;"></div>
    <div class="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-black/25 to-transparent" style="width:16px;"></div>
  `
}

function sideButtonsHTML(device) {
  if (device.orientation === 'landscape') {
    return `
      <div class="absolute rounded-full bg-black/30" style="top:-4px;right:120px;width:70px;height:4px;"></div>
      <div class="absolute rounded-full bg-black/30" style="top:-4px;right:230px;width:44px;height:4px;"></div>
    `
  }
  return `
    <div class="absolute rounded-full bg-black/30" style="left:-4px;top:14%;width:4px;height:34px;"></div>
    <div class="absolute rounded-full bg-black/30" style="left:-4px;top:22%;width:4px;height:64px;"></div>
    <div class="absolute rounded-full bg-black/30" style="left:-4px;top:34%;width:4px;height:64px;"></div>
    <div class="absolute rounded-full bg-black/30" style="right:-4px;top:24%;width:4px;height:92px;"></div>
  `
}

/** iOS Safari-style bottom toolbar: address pill + back/forward/share/tabs row. */
function bottomBarHTML(browser) {
  const wrapTone = browser.dark ? 'bg-neutral-900/95' : 'bg-slate-50/95 dark:bg-neutral-900/95'
  const barTone = browser.dark
    ? 'bg-white/10 text-slate-200'
    : 'bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-200'
  return `
    <div class="order-last shrink-0 border-t border-slate-200/70 ${wrapTone} backdrop-blur dark:border-white/10" style="padding:8px 16px 26px;">
      <div class="flex items-center ${barTone}" style="gap:6px;border-radius:12px;padding:9px 12px;margin-bottom:10px;">
        <svg style="width:14px;height:14px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${LOCK_ICON_PATH}</svg>
        <span id="browser-url-text" class="flex-1 truncate text-center font-medium" style="font-size:15px;">example.com</span>
        <span class="shrink-0 overflow-hidden rounded-full" style="width:16px;height:16px;">${browserLogoHTML(browser.id, 'bottom')}</span>
      </div>
      <div class="flex items-center justify-between text-slate-400 dark:text-slate-500" style="padding:0 6px;">
        <svg style="width:22px;height:22px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
        <svg style="width:22px;height:22px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" /></svg>
        <svg style="width:22px;height:22px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
        <svg style="width:22px;height:22px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4.5 6.75h15M4.5 12h15M4.5 17.25h15" /></svg>
        <svg style="width:22px;height:22px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4.5" y="4.5" width="15" height="15" rx="3.5" /></svg>
      </div>
    </div>
  `
}

/** Android Chrome-style top toolbar: address bar with overflow menu. */
function topBarHTML(browser, device) {
  const barTone = browser.dark
    ? 'bg-white/10 text-slate-200'
    : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  const wrapTone = browser.dark ? 'bg-neutral-900' : 'bg-slate-50 dark:bg-slate-900'
  const h = device.category === 'iPad' ? 64 : 56
  return `
    <div class="order-first flex shrink-0 items-center border-b border-slate-200/70 ${wrapTone} dark:border-slate-800" style="height:${h}px;gap:10px;padding:6px 14px 0;">
      <span class="shrink-0 overflow-hidden rounded-full" style="width:18px;height:18px;">${browserLogoHTML(browser.id, 'top')}</span>
      <div class="flex flex-1 items-center ${browser.bar} ${barTone}" style="gap:7px;padding:8px 12px;">
        <svg style="width:14px;height:14px;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${LOCK_ICON_PATH}</svg>
        <span id="browser-url-text" class="truncate font-medium" style="font-size:15px;">example.com</span>
      </div>
      <svg class="shrink-0 opacity-60" style="width:18px;height:18px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5.5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="18.5" r="1.2" /></svg>
    </div>
  `
}

function browserChromeHTML(browser, device) {
  // Real-world convention: iOS Safari/Chrome keep the address bar docked at
  // the bottom; Android + iPadOS browsers keep it pinned to the top.
  return device.category === 'iPhone' ? bottomBarHTML(browser) : topBarHTML(browser, device)
}

function previewAreaHTML() {
  return `
    <div class="relative order-none min-h-0 flex-1 overflow-hidden bg-white dark:bg-neutral-950">
      <iframe
        id="preview-iframe"
        title="Website preview"
        referrerpolicy="no-referrer"
        class="h-full w-full border-0 ${state.currentUrl ? '' : 'hidden'}"
        ${state.currentUrl ? `src="${state.currentUrl}"` : ''}
      ></iframe>

      <div id="preview-empty" class="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 text-center dark:from-neutral-950 dark:to-neutral-900 ${state.currentUrl ? 'hidden' : ''}" style="gap:16px;padding:0 32px;">
        <div class="grid place-items-center rounded-3xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10" style="width:72px;height:72px;">
          <svg style="width:36px;height:36px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3s4.5 4.03 4.5 9-2.015 9-4.5 9ZM3.5 9h17M3.5 15h17" /></svg>
        </div>
        <p class="font-medium text-slate-600 dark:text-slate-300" style="font-size:19px;">Paste a URL above to preview it here</p>
        <p class="text-slate-400 dark:text-slate-500" style="font-size:15px;">Live rendering will appear inside this frame</p>
      </div>

      <div id="preview-loading" class="pointer-events-none absolute inset-0 hidden items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-neutral-950/70">
        <div class="animate-spin rounded-full border-indigo-500 border-t-transparent" style="width:44px;height:44px;border-width:3px;border-style:solid;"></div>
      </div>

      <div id="preview-stalled" class="pointer-events-none absolute hidden items-center justify-between bg-slate-900/90 text-white shadow-lg dark:bg-black/85" style="left:12px;right:12px;bottom:12px;gap:10px;border-radius:10px;padding:10px 14px;font-size:14px;line-height:1.3;">
        <span>Taking a while — this site may block embedded previews</span>
        <a id="preview-open-external" class="pointer-events-auto shrink-0 font-semibold underline" target="_blank" rel="noopener noreferrer">Open ↗</a>
      </div>
    </div>
  `
}

/**
 * Enable finger-drag scrolling inside the loaded page. Only possible for
 * same-origin documents — the browser blocks reaching into a cross-origin
 * iframe, so we surface that instead of failing silently.
 */
let crossOriginNoticeShown = false

function setupDragScroll(iframe) {
  dragHandle?.detach()
  dragHandle = null
  if (!state.dragScroll) return

  const result = attachDragScroll(iframe)
  if (result.ok) {
    dragHandle = result
    return
  }
  if (result.reason === 'cross-origin' && !crossOriginNoticeShown) {
    crossOriginNoticeShown = true
    toast('Drag scrolling needs a same-origin page. Use your wheel or trackpad to scroll this site.', 'info', 5200)
  }
}

function wirePreviewIframe() {
  clearTimeout(loadStallTimer)
  dragHandle?.detach()
  dragHandle = null

  const iframe = $('#preview-iframe')
  const loading = $('#preview-loading')
  const stalled = $('#preview-stalled')
  const openExternal = $('#preview-open-external')
  if (!iframe) return

  if (openExternal) openExternal.href = state.currentUrl || '#'
  if (!state.currentUrl) return

  loading.classList.remove('hidden')
  loading.classList.add('flex')
  stalled.classList.add('hidden')
  stalled.classList.remove('flex')

  iframe.addEventListener(
    'load',
    () => {
      loading.classList.add('hidden')
      loading.classList.remove('flex')
      stalled.classList.add('hidden')
      stalled.classList.remove('flex')
      clearTimeout(loadStallTimer)
      setupDragScroll(iframe)
    },
    { once: true }
  )

  loadStallTimer = setTimeout(() => {
    stalled.classList.remove('hidden')
    stalled.classList.add('flex')
  }, 6000)
}

/** Outer frame dimensions (screen + bezels) in real device px. */
function frameSize(device) {
  const chin = device.chin ?? device.bezel
  const chinOnSide = device.rotated && !!device.chin
  return {
    chin,
    chinOnSide,
    w: device.vw + device.bezel + (chinOnSide ? chin : device.bezel),
    h: device.vh + device.bezel + (chinOnSide ? device.bezel : chin),
  }
}

/**
 * Scale needed to fit the full-size mockup into the canvas. Zoom is applied
 * on top of this, so "100%" means "fit to canvas" rather than 1 device px
 * to 1 screen px — a 956px-tall phone would never fit otherwise.
 */
function computeFitScale(device) {
  const { w, h } = frameSize(device)
  const PADDING = 64 // canvas p-8 on both sides
  const LABEL = 44 // caption below the device
  const TOOLBAR = 76 // floating toolbar hovering over the canvas bottom
  const availW = (els.canvasArea?.clientWidth ?? 800) - PADDING
  const availH = (els.canvasArea?.clientHeight ?? 600) - PADDING - LABEL - TOOLBAR
  return Math.min(availW / w, availH / h, 1)
}

function updateDeviceLabel() {
  const device = getDevice()
  const skin = getSkin()
  els.deviceLabel.textContent = `${device.name} · ${device.vw} × ${device.vh} · ${skin.name} · ${state.zoom}%`
}

/** Position and scale the frame; also sizes the stage so centring stays right. */
function applyZoom() {
  const device = getDevice()
  const { w, h } = frameSize(device)
  const scale = computeFitScale(device) * (state.zoom / 100)

  const frameEl = els.deviceFrame.firstElementChild
  if (frameEl) {
    frameEl.style.transform = `scale(${scale})`
    frameEl.style.transformOrigin = 'top left'
  }
  // Transforms don't affect layout, so mirror the scaled box onto the wrapper.
  els.deviceFrame.style.width = `${w * scale}px`
  els.deviceFrame.style.height = `${h * scale}px`

  updateDeviceLabel()
}

/** Cheap re-skin: recolor the existing frame without reloading the preview. */
function applySkinOnly() {
  const skin = getSkin()
  const frameEl = els.deviceFrame.firstElementChild
  if (frameEl) {
    frameEl.style.borderColor = skin.color
    frameEl.style.background = skin.color
  }
  updateDeviceLabel()
}

function renderDeviceFrame() {
  const device = getDevice()
  const skin = getSkin()
  const browser = getBrowser()
  const { chin, chinOnSide, w, h } = frameSize(device)
  const innerRadius = Math.max(device.radius - device.bezel, 4)

  // iPhone SE has a much thicker "chin" housing the home button; every other
  // device keeps a uniform bezel on all four sides. Rotating moves the chin
  // from the bottom edge to the right edge.
  const b = device.bezel
  const borderWidth = chinOnSide ? `${b}px ${chin}px ${b}px ${b}px` : `${b}px ${b}px ${chin}px ${b}px`
  const borderStyle = `border-style:solid;border-color:${skin.color};border-width:${borderWidth};`

  els.deviceFrame.innerHTML = `
    <div class="relative shadow-2xl"
         style="width:${w}px;height:${h}px;border-radius:${device.radius}px;${borderStyle}background:${skin.color};box-sizing:border-box;">
      ${sideButtonsHTML(device)}
      <div class="relative flex flex-col overflow-hidden bg-white dark:bg-neutral-950"
           style="width:${device.vw}px;height:${device.vh}px;border-radius:${innerRadius}px;">
        ${browserChromeHTML(browser, device)}
        ${previewAreaHTML()}
        ${device.edge === 'curved' ? curvedEdgeHTML() : ''}
        ${homeIndicatorHTML(device)}
      </div>
      ${cutoutHTML(device)}
      ${device.cameraInBezel ? `<div class="absolute left-1/2 -translate-x-1/2 rounded-full bg-black/50" style="top:-16px;width:8px;height:8px;"></div>` : ''}
    </div>
  `

  applyZoom()

  const urlText = $('#browser-url-text')
  if (urlText) {
    if (state.currentUrl) {
      try {
        urlText.textContent = new URL(state.currentUrl).hostname.replace(/^www\./, '')
      } catch {
        urlText.textContent = state.currentUrl
      }
    } else {
      urlText.textContent = 'example.com'
    }
  }

  wirePreviewIframe()
}

/* ------------------------------------------------------------------ */
/*  Capture: screenshot + recording                                    */
/* ------------------------------------------------------------------ */

/** The element we crop captures to — the physical device frame itself. */
const captureTarget = () => els.deviceFrame.firstElementChild ?? els.deviceFrame

function captureFilename(ext) {
  const device = getBaseDevice().name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  let host = 'preview'
  try {
    host = new URL(state.currentUrl).hostname.replace(/^www\./, '')
  } catch {
    /* no URL loaded yet — keep the generic name */
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `${host}-${device}-${stamp}.${ext}`
}

/** Hide our own chrome so it can't land in the captured frame. */
function setCaptureMode(on) {
  $('#canvas-toolbar')?.classList.toggle('invisible', on)
  els.canvasArea?.classList.toggle('is-hovering', false)
}

async function doScreenshot() {
  if (!captureSupported()) {
    toast('This browser has no Screen Capture API, so screenshots are unavailable.', 'error')
    return
  }
  setCaptureMode(true)
  try {
    const blob = await captureScreenshot(captureTarget())
    downloadBlob(blob, captureFilename('png'))
    toast('Screenshot saved', 'success')
  } catch (err) {
    if (err?.name === 'NotAllowedError') toast('Screen capture was cancelled', 'info')
    else toast(`Screenshot failed: ${err?.message ?? err}`, 'error')
  } finally {
    setCaptureMode(false)
  }
}

function formatElapsed(ms) {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function setRecordingUI(on) {
  $('#rec-status')?.classList.toggle('hidden', !on)
  $('#rec-status')?.classList.toggle('flex', on)
  $('#rec-icon')?.classList.toggle('animate-pulse', on)
  const title = $('#rec-card-title')
  if (title) title.textContent = on ? 'Recording… click to stop' : 'Record scrolling'
  $('#canvas-toolbar')?.classList.toggle('invisible', on)
}

async function toggleRecording() {
  if (recorder) {
    const handle = recorder
    recorder = null
    setRecordingUI(false)
    try {
      const blob = await handle.stop()
      if (blob.size) {
        downloadBlob(blob, captureFilename(handle.extension))
        toast('Recording saved', 'success')
      } else {
        toast('Recording was empty — nothing saved', 'error')
      }
    } catch (err) {
      toast(`Recording failed: ${err?.message ?? err}`, 'error')
    }
    return
  }

  if (!recordingSupported()) {
    toast('This browser cannot record — MediaRecorder or Screen Capture is unavailable.', 'error')
    return
  }

  try {
    const handle = await startRecording(captureTarget(), {
      onTick: (ms) => {
        const t = $('#rec-time')
        if (t) t.textContent = formatElapsed(ms)
      },
    })
    recorder = handle
    setRecordingUI(true)
    toast('Recording — scroll the preview, then press Stop', 'info')
  } catch (err) {
    if (err?.name === 'NotAllowedError') toast('Screen capture was cancelled', 'info')
    else toast(`Could not start recording: ${err?.message ?? err}`, 'error')
  }
}

function toggleRotate() {
  state.rotated = !state.rotated
  renderDeviceFrame()
  const d = getDevice()
  toast(`${getBaseDevice().name} — ${d.vw} × ${d.vh}`, 'info', 1800)
}

function toggleDragScroll() {
  state.dragScroll = !state.dragScroll
  const btn = $('#drag-toggle')
  btn?.setAttribute('aria-pressed', String(state.dragScroll))
  btn?.classList.toggle('bg-indigo-50', state.dragScroll)
  btn?.classList.toggle('text-indigo-600', state.dragScroll)
  btn?.classList.toggle('dark:bg-indigo-500/15', state.dragScroll)
  btn?.classList.toggle('dark:text-indigo-400', state.dragScroll)

  const iframe = $('#preview-iframe')
  if (state.dragScroll) {
    if (iframe) setupDragScroll(iframe)
    toast('Touch drag scrolling on', 'info', 1600)
  } else {
    dragHandle?.detach()
    dragHandle = null
    toast('Touch drag scrolling off', 'info', 1600)
  }
}

function normalizeUrl(raw) {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`
  return `https://${trimmed}`
}

function loadPreview(rawUrl) {
  const url = normalizeUrl(rawUrl)
  if (!url) return
  state.currentUrl = url
  if (els.urlInput) els.urlInput.value = url
  renderDeviceFrame()
}

/* ------------------------------------------------------------------ */
/*  Sidebar: devices tab                                               */
/* ------------------------------------------------------------------ */

function deviceThumbHTML(device) {
  const isLandscape = device.orientation === 'landscape'
  const dims = isLandscape ? 'h-7 w-11' : 'h-10 w-7'
  return `<div class="${dims} shrink-0 rounded-[6px] border-2 border-current"></div>`
}

function renderCategoryPills() {
  els.categoryPills.innerHTML = CATEGORIES.map((cat) => {
    const active = state.category === cat
    const cls = active
      ? 'rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white'
      : 'rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
    return `<button type="button" data-category="${cat}" class="${cls}">${cat}</button>`
  }).join('')
}

function renderDeviceList() {
  const list = DEVICES.filter((d) => state.category === 'All' || d.category === state.category)
  els.deviceList.innerHTML = list
    .map((device) => {
      const selected = device.id === state.deviceId
      const cardCls = selected
        ? 'flex w-full items-center gap-3 rounded-xl border border-indigo-300 bg-indigo-50 p-2.5 text-left ring-1 ring-indigo-200 text-slate-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:ring-indigo-500/30 dark:text-slate-100'
        : 'flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60'
      return `
        <button type="button" data-device="${device.id}" class="${cardCls}">
          ${deviceThumbHTML(device)}
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm ${selected ? 'font-semibold' : 'font-medium text-slate-700 dark:text-slate-200'}">${device.name}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${device.vw} × ${device.vh} · ${cutoutLabel(device)}</p>
          </div>
          ${selected ? '<svg class="h-4 w-4 shrink-0 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>' : ''}
        </button>
      `
    })
    .join('')
}

function cutoutLabel(device) {
  switch (device.cutout) {
    case 'island':
      return 'Dynamic Island'
    case 'punch-center':
      return device.edge === 'curved' ? 'Curved edge' : 'Punch-hole'
    case 'punch-corner':
      return 'Cover punch-hole'
    case 'home':
      return 'Home button'
    default:
      return 'Landscape'
  }
}

/* ------------------------------------------------------------------ */
/*  Sidebar: skins tab                                                 */
/* ------------------------------------------------------------------ */

function renderSkinGrid() {
  const groups = ['iPhone', 'Samsung', 'Pixel', 'iPad', 'All']
  const groupLabels = { iPhone: 'iPhone finishes', Samsung: 'Samsung finishes', Pixel: 'Pixel finishes', iPad: 'iPad finishes', All: 'Universal' }

  els.skinGrid.innerHTML = groups
    .map((group) => {
      const skins = SKINS.filter((s) => s.category === group)
      if (!skins.length) return ''
      return `
        <div class="mb-4">
          <p class="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">${groupLabels[group]}</p>
          <div class="grid grid-cols-4 gap-2.5">
            ${skins
              .map((skin) => {
                const selected = skin.id === state.skinId
                const ring = selected
                  ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                  : 'ring-1 ring-black/10 dark:ring-white/10'
                return `
                  <button type="button" data-skin="${skin.id}" class="group flex flex-col items-center gap-1" title="${skin.name}">
                    <span class="h-8 w-8 rounded-full ${ring} transition" style="background:${skin.color};"></span>
                    <span class="line-clamp-1 max-w-[4.5rem] text-center text-[10px] font-medium ${selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}">${skin.name}</span>
                  </button>
                `
              })
              .join('')}
          </div>
        </div>
      `
    })
    .join('')
}

/* ------------------------------------------------------------------ */
/*  Sidebar: saved tab                                                 */
/* ------------------------------------------------------------------ */

function renderSavedList() {
  if (!state.saved.length) {
    els.savedList.innerHTML = `
      <div class="rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-700">
        <p class="text-xs text-slate-500 dark:text-slate-400">No saved configurations yet.</p>
        <p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Set up a device + skin, then save it below.</p>
      </div>
    `
    return
  }

  els.savedList.innerHTML = state.saved
    .map((cfg) => {
      const device = DEVICES.find((d) => d.id === cfg.deviceId)
      const skin = SKINS.find((s) => s.id === cfg.skinId)
      return `
        <div class="group flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-500/40">
          <button type="button" data-load="${cfg.id}" class="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span class="h-8 w-6 shrink-0 rounded-md" style="background:${skin?.color ?? '#333'};"></span>
            <span class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">${device?.name ?? 'Unknown device'}</p>
              <p class="truncate text-xs text-slate-500 dark:text-slate-400">${skin?.name ?? ''} · ${cfg.browserId} · ${cfg.zoom}%</p>
            </span>
          </button>
          <button type="button" data-delete="${cfg.id}" class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-500/10" aria-label="Delete saved configuration">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      `
    })
    .join('')
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

function renderTabs() {
  els.tabs.forEach((btn) => {
    const active = btn.dataset.tab === state.tab
    btn.className = active
      ? 'sidebar-tab flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900'
      : 'sidebar-tab flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
  })
  Object.entries(els.panels).forEach(([key, panel]) => {
    panel.classList.toggle('hidden', key !== state.tab)
  })
}

/* ------------------------------------------------------------------ */
/*  Browser selector                                                   */
/* ------------------------------------------------------------------ */

function renderBrowserMenu() {
  els.browserMenu.innerHTML = BROWSERS.map((b) => {
    const selected = b.id === state.browserId
    return `
      <button type="button" data-browser="${b.id}" class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}">
        <span class="h-4 w-4 shrink-0 overflow-hidden rounded-full">${browserLogoHTML(b.id, 'menu')}</span>
        <span class="flex-1">${b.name}</span>
        ${selected ? '<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>' : ''}
      </button>
    `
  }).join('')

  const current = getBrowser()
  els.browserDot.innerHTML = browserLogoHTML(current.id, 'header')
  els.browserLabel.textContent = current.name
}

function setBrowserMenuOpen(open) {
  state.browserMenuOpen = open
  els.browserMenu.classList.toggle('hidden', !open)
  els.browserBtn.setAttribute('aria-expanded', String(open))
}

/* ------------------------------------------------------------------ */
/*  Canvas hover glow / wave effect                                    */
/* ------------------------------------------------------------------ */

function bindCanvasGlow() {
  const area = els.canvasArea
  let raf = null

  area.addEventListener('pointerenter', () => area.classList.add('is-hovering'))
  area.addEventListener('pointerleave', () => area.classList.remove('is-hovering'))

  area.addEventListener('pointermove', (e) => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      const rect = area.getBoundingClientRect()
      area.style.setProperty('--mx', `${e.clientX - rect.left}px`)
      area.style.setProperty('--my', `${e.clientY - rect.top}px`)
      raf = null
    })
  })
}

/* ------------------------------------------------------------------ */
/*  Event bindings                                                     */
/* ------------------------------------------------------------------ */

function bindEvents() {
  els.tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab
      renderTabs()
    })
  })

  els.categoryPills.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category]')
    if (!btn) return
    state.category = btn.dataset.category
    renderCategoryPills()
    renderDeviceList()
  })

  els.deviceList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-device]')
    if (!btn) return
    state.deviceId = btn.dataset.device
    renderDeviceList()
    renderDeviceFrame()
  })

  els.skinGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-skin]')
    if (!btn) return
    state.skinId = btn.dataset.skin
    renderSkinGrid()
    applySkinOnly() // recolor in place — no need to reload the live preview
  })

  els.savedList.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('[data-load]')
    const delBtn = e.target.closest('[data-delete]')
    if (delBtn) {
      state.saved = state.saved.filter((c) => c.id !== delBtn.dataset.delete)
      persistSaved()
      renderSavedList()
      return
    }
    if (loadBtn) {
      const cfg = state.saved.find((c) => c.id === loadBtn.dataset.load)
      if (!cfg) return
      state.deviceId = cfg.deviceId
      state.skinId = cfg.skinId
      state.browserId = cfg.browserId
      state.zoom = cfg.zoom
      renderDeviceList()
      renderSkinGrid()
      renderBrowserMenu()
      renderZoom()
      renderDeviceFrame()
    }
  })

  els.saveConfigBtn.addEventListener('click', () => {
    const device = getDevice()
    const skin = getSkin()
    state.saved.unshift({
      id: `${device.id}-${skin.id}-${state.saved.length}-${Math.floor(state.zoom)}`,
      deviceId: device.id,
      skinId: skin.id,
      browserId: state.browserId,
      zoom: state.zoom,
    })
    persistSaved()
    state.tab = 'saved'
    renderTabs()
    renderSavedList()
  })

  // Browser dropdown
  els.browserBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    setBrowserMenuOpen(!state.browserMenuOpen)
  })
  els.browserMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-browser]')
    if (!btn) return
    state.browserId = btn.dataset.browser
    renderBrowserMenu()
    renderDeviceFrame()
    setBrowserMenuOpen(false)
  })
  document.addEventListener('click', (e) => {
    if (state.browserMenuOpen && !els.browserMenu.contains(e.target) && !els.browserBtn.contains(e.target)) {
      setBrowserMenuOpen(false)
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setBrowserMenuOpen(false)
  })

  // Zoom — just rescales the stage, the live preview keeps running untouched
  els.zoomOut.addEventListener('click', () => {
    state.zoom = Math.max(50, state.zoom - 10)
    renderZoom()
    applyZoom()
  })
  els.zoomIn.addEventListener('click', () => {
    state.zoom = Math.min(150, state.zoom + 10)
    renderZoom()
    applyZoom()
  })

  // Reload — refreshes the loaded page, same-origin or not
  els.reloadBtn.addEventListener('click', () => {
    els.reloadIcon.classList.remove('animate-spin-once')
    void els.reloadIcon.offsetWidth
    els.reloadIcon.classList.add('animate-spin-once')

    const iframe = $('#preview-iframe')
    if (!iframe || !state.currentUrl) return
    try {
      iframe.contentWindow.location.reload()
    } catch {
      const bust = state.currentUrl.includes('?') ? '&' : '?'
      iframe.src = `${state.currentUrl}${bust}_r=${Math.random().toString(36).slice(2)}`
    }
    wirePreviewIframe()
  })

  // Go / URL enter — this is the actual "navigate" action
  const applyUrl = () => loadPreview(els.urlInput?.value)
  els.goBtn?.addEventListener('click', applyUrl)
  els.urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyUrl()
  })

  // Fullscreen
  els.fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      els.canvasArea.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  })

  // Theme
  els.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light')
  })

  // Capture, rotate, drag-scroll
  $('#shot-btn')?.addEventListener('click', doScreenshot)
  $('#shot-card')?.addEventListener('click', doScreenshot)
  $('#rec-btn')?.addEventListener('click', toggleRecording)
  $('#rec-card')?.addEventListener('click', toggleRecording)
  $('#rec-stop')?.addEventListener('click', toggleRecording)
  $('#rotate-btn')?.addEventListener('click', toggleRotate)
  $('#drag-toggle')?.addEventListener('click', toggleDragScroll)

  // Keyboard shortcuts (skip while typing in the URL bar)
  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    const mod = e.metaKey || e.ctrlKey

    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault()
      doScreenshot()
      return
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      els.themeToggle.click()
      return
    }
    if (mod && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      els.reloadBtn.click()
      return
    }
    if (typing || mod) return

    if (e.key.toLowerCase() === 'f') {
      e.preventDefault()
      els.fullscreenBtn.click()
    } else if (e.key.toLowerCase() === 'o') {
      e.preventDefault()
      toggleRotate()
    }
  })

  // Keep the device fitted when the canvas area changes size
  let resizeRaf = null
  window.addEventListener('resize', () => {
    if (resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      applyZoom()
      resizeRaf = null
    })
  })

  bindCanvasGlow()
}

function renderZoom() {
  els.zoomLabel.textContent = `${state.zoom}%`
  els.zoomOut.disabled = state.zoom <= 50
  els.zoomIn.disabled = state.zoom >= 150
}

function applyStoredTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored) {
    document.documentElement.classList.toggle('dark', stored === 'dark')
  }
}

function init() {
  applyStoredTheme()
  cacheEls()
  state.currentUrl = normalizeUrl(els.urlInput?.value)
  renderTabs()
  renderCategoryPills()
  renderDeviceList()
  renderSkinGrid()
  renderSavedList()
  renderBrowserMenu()
  renderZoom()
  renderDeviceFrame()
  bindEvents()

  // Reflect the default-on drag-scroll state in the toolbar button
  const dragBtn = $('#drag-toggle')
  if (state.dragScroll && dragBtn) {
    dragBtn.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-500/15', 'dark:text-indigo-400')
  }
}

document.addEventListener('DOMContentLoaded', init)
