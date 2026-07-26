import './style.css'
import { DEVICES, CATEGORIES, SKINS, BROWSERS, LOCK_ICON_PATH, browserLogoHTML } from './data.js'

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
  saved: loadSaved(),
}

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

const getDevice = () => DEVICES.find((d) => d.id === state.deviceId) ?? DEVICES[0]
const getSkin = () => SKINS.find((s) => s.id === state.skinId) ?? SKINS[0]
const getBrowser = () => BROWSERS.find((b) => b.id === state.browserId) ?? BROWSERS[0]

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

function cutoutHTML(device) {
  switch (device.cutout) {
    case 'island':
      return `<div class="absolute left-1/2 top-3 h-6 w-28 -translate-x-1/2 rounded-full bg-black"></div>`
    case 'punch-center':
      return `<div class="absolute left-1/2 top-3 h-3 w-3 -translate-x-1/2 rounded-full bg-black ring-2 ring-black/40"></div>`
    case 'punch-corner':
      return `<div class="absolute right-5 top-3 h-3 w-3 rounded-full bg-black ring-2 ring-black/40"></div>`
    case 'home':
      // Speaker + camera sit in the top bezel (border band), the Touch ID
      // button sits in the thicker bottom "chin" — both outside the screen.
      return `
        <div class="absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5" style="top:-9px;">
          <span class="h-[3px] w-8 rounded-full bg-black/40"></span>
          <span class="h-1.5 w-1.5 rounded-full bg-black/40"></span>
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 rounded-full border-[2.5px] border-black/45" style="bottom:-41px;height:32px;width:32px;"></div>
      `
    default:
      return ''
  }
}

function homeIndicatorHTML(device) {
  if (device.cutout === 'home') return '' // physical home button already present
  const width = device.orientation === 'landscape' ? 'w-32' : 'w-24'
  return `<div class="pointer-events-none absolute bottom-1.5 left-1/2 z-10 h-1 ${width} -translate-x-1/2 rounded-full bg-black/60 dark:bg-white/80"></div>`
}

function curvedEdgeHTML() {
  return `
    <div class="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/25 to-transparent"></div>
    <div class="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/25 to-transparent"></div>
  `
}

function sideButtonsHTML(device) {
  if (device.orientation === 'landscape') {
    return `
      <div class="absolute -top-[9px] right-16 h-[3px] w-10 rounded-full bg-black/30"></div>
      <div class="absolute -top-[9px] right-28 h-[3px] w-6 rounded-full bg-black/30"></div>
    `
  }
  return `
    <div class="absolute -left-[9px] top-[14%] h-7 w-[3px] rounded-full bg-black/30"></div>
    <div class="absolute -left-[9px] top-[22%] h-12 w-[3px] rounded-full bg-black/30"></div>
    <div class="absolute -left-[9px] top-[34%] h-12 w-[3px] rounded-full bg-black/30"></div>
    <div class="absolute -right-[9px] top-[24%] h-16 w-[3px] rounded-full bg-black/30"></div>
  `
}

/** iOS Safari-style bottom toolbar: address pill + back/forward/share/tabs row. */
function bottomBarHTML(browser) {
  const wrapTone = browser.dark ? 'bg-neutral-900/95' : 'bg-slate-50/95 dark:bg-neutral-900/95'
  const barTone = browser.dark
    ? 'bg-white/10 text-slate-200'
    : 'bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-200'
  return `
    <div class="order-last shrink-0 border-t border-slate-200/70 ${wrapTone} px-3 pb-4 pt-2 backdrop-blur dark:border-white/10">
      <div class="mb-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 ${barTone}">
        <svg class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${LOCK_ICON_PATH}</svg>
        <span id="browser-url-text" class="flex-1 truncate text-center text-[11px] font-medium">example.com</span>
        <span class="h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full">${browserLogoHTML(browser.id, 'bottom')}</span>
      </div>
      <div class="flex items-center justify-between px-1 text-slate-400 dark:text-slate-500">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" /></svg>
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4.5 6.75h15M4.5 12h15M4.5 17.25h15" /></svg>
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4.5" y="4.5" width="15" height="15" rx="3.5" /></svg>
      </div>
    </div>
  `
}

/** Android Chrome-style top toolbar: address bar with menu button. */
function topBarHTML(browser) {
  const barTone = browser.dark
    ? 'bg-white/10 text-slate-200'
    : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  const wrapTone = browser.dark ? 'bg-neutral-900' : 'bg-slate-50 dark:bg-slate-900'
  return `
    <div class="order-first flex h-11 shrink-0 items-center gap-2 border-b border-slate-200/70 ${wrapTone} px-3 pt-1.5 dark:border-slate-800">
      <span class="h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full">${browserLogoHTML(browser.id, 'top')}</span>
      <div class="flex flex-1 items-center gap-1.5 px-2 py-1 ${browser.bar} ${barTone}">
        <svg class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${LOCK_ICON_PATH}</svg>
        <span id="browser-url-text" class="truncate text-[11px] font-medium">example.com</span>
      </div>
      <svg class="h-3.5 w-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5.5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="18.5" r="1.2" /></svg>
    </div>
  `
}

function browserChromeHTML(browser, device) {
  // Real-world convention: iOS Safari/Chrome keep the address bar docked at
  // the bottom; Android + iPadOS browsers keep it pinned to the top.
  return device.category === 'iPhone' ? bottomBarHTML(browser) : topBarHTML(browser)
}

function pagePlaceholderHTML() {
  return `
    <div class="order-none flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-slate-50 px-6 text-center dark:from-neutral-950 dark:to-neutral-900">
      <div class="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3s4.5 4.03 4.5 9-2.015 9-4.5 9ZM3.5 9h17M3.5 15h17" /></svg>
      </div>
      <p class="text-sm font-medium text-slate-600 dark:text-slate-300">Paste a URL above to preview it here</p>
      <p class="text-xs text-slate-400 dark:text-slate-500">Live rendering will appear inside this frame</p>
    </div>
  `
}

function renderDeviceFrame() {
  const device = getDevice()
  const skin = getSkin()
  const browser = getBrowser()
  const innerRadius = Math.max(device.radius - device.bezel, 4)
  const isHomeButton = device.cutout === 'home'

  // iPhone SE has a much thicker bottom "chin" to house the physical home
  // button — every other device keeps a uniform bezel on all sides.
  const bottomBezel = isHomeButton ? Math.round(device.bezel * 3.5) : device.bezel
  const borderStyle = `border-style:solid;border-color:${skin.color};border-width:${device.bezel}px ${device.bezel}px ${bottomBezel}px ${device.bezel}px;`

  els.deviceFrame.innerHTML = `
    <div class="relative shadow-2xl transition-[width,height,border-radius] duration-300 ease-out"
         style="width:${device.w}px;height:${device.h}px;border-radius:${device.radius}px;${borderStyle}background:${skin.color};">
      ${sideButtonsHTML(device)}
      <div class="relative flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-950" style="border-radius:${innerRadius}px;">
        ${browserChromeHTML(browser, device)}
        ${pagePlaceholderHTML()}
        ${device.edge === 'curved' ? curvedEdgeHTML() : ''}
        ${homeIndicatorHTML(device)}
      </div>
      ${cutoutHTML(device)}
      ${device.cameraInBezel ? `<div class="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-black/50"></div>` : ''}
    </div>
  `

  els.deviceLabel.textContent = `${device.name} · ${skin.name} · ${state.zoom}%`
  els.deviceStage.style.transform = `scale(${state.zoom / 100})`

  const url = els.urlInput?.value?.trim()
  const urlText = $('#browser-url-text')
  if (urlText && url) {
    try {
      urlText.textContent = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      urlText.textContent = url
    }
  }
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
            <p class="text-xs text-slate-500 dark:text-slate-400">${device.res} · ${cutoutLabel(device)}</p>
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
    renderDeviceFrame()
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

  // Zoom
  els.zoomOut.addEventListener('click', () => {
    state.zoom = Math.max(50, state.zoom - 10)
    renderZoom()
    renderDeviceFrame()
  })
  els.zoomIn.addEventListener('click', () => {
    state.zoom = Math.min(150, state.zoom + 10)
    renderZoom()
    renderDeviceFrame()
  })

  // Reload
  els.reloadBtn.addEventListener('click', () => {
    els.reloadIcon.classList.remove('animate-spin-once')
    void els.reloadIcon.offsetWidth
    els.reloadIcon.classList.add('animate-spin-once')
    renderDeviceFrame()
  })

  // Go / URL enter
  const applyUrl = () => renderDeviceFrame()
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
  renderTabs()
  renderCategoryPills()
  renderDeviceList()
  renderSkinGrid()
  renderSavedList()
  renderBrowserMenu()
  renderZoom()
  renderDeviceFrame()
  bindEvents()
}

document.addEventListener('DOMContentLoaded', init)
