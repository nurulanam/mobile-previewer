/**
 * Finger-style drag scrolling inside the previewed page.
 *
 * We attach directly to the iframe's own document rather than overlaying a
 * capture layer — that way links, buttons and text selection keep working,
 * and we only take over once the pointer has actually travelled far enough
 * to count as a drag rather than a tap.
 *
 * This requires reading `iframe.contentDocument`, which the browser only
 * permits for same-origin pages. For cross-origin sites we report that back
 * so the UI can say so plainly instead of silently doing nothing.
 */

const DRAG_THRESHOLD = 6 // px before a press becomes a drag (so taps still tap)
const FRICTION = 0.94 // per-frame velocity decay during momentum
const MIN_VELOCITY = 0.02 // px/ms — below this, momentum stops

const REALISM_CSS = `
  html { -webkit-text-size-adjust: 100%; }
  html, body { scrollbar-width: none !important; }
  html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
  html { cursor: grab; overscroll-behavior: contain; }
  html.mp-dragging, html.mp-dragging * { cursor: grabbing !important; user-select: none !important; }
`

/**
 * @returns {{ok: true, detach: () => void} | {ok: false, reason: 'cross-origin'|'not-ready'}}
 */
export function attachDragScroll(iframe) {
  let doc
  let win
  try {
    doc = iframe.contentDocument
    win = iframe.contentWindow
    if (!doc || !win) return { ok: false, reason: 'not-ready' }
    void doc.body // touching this throws on cross-origin
  } catch {
    return { ok: false, reason: 'cross-origin' }
  }
  if (!doc.documentElement) return { ok: false, reason: 'not-ready' }

  const style = doc.createElement('style')
  style.textContent = REALISM_CSS
  doc.head?.appendChild(style)

  let dragging = false
  let decided = false
  let pointerId = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let lastT = 0
  let vx = 0
  let vy = 0
  let momentumId = null

  const stopMomentum = () => {
    if (momentumId) {
      win.cancelAnimationFrame(momentumId)
      momentumId = null
    }
  }

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    stopMomentum()
    dragging = true
    decided = false
    pointerId = e.pointerId
    startX = lastX = e.clientX
    startY = lastY = e.clientY
    lastT = e.timeStamp
    vx = vy = 0
  }

  const onPointerMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return

    if (!decided) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return
      decided = true
      doc.documentElement.classList.add('mp-dragging')
      // Only capture once we're sure it's a drag, so clicks aren't swallowed.
      try {
        e.target.setPointerCapture?.(e.pointerId)
      } catch {
        /* element may not support capture — dragging still works */
      }
    }

    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    const dt = Math.max(1, e.timeStamp - lastT)

    // Content follows the finger: drag down => page scrolls up.
    win.scrollBy(-dx, -dy)

    // Smooth the velocity a little so a jittery last frame doesn't dominate.
    vx = 0.8 * (dx / dt) + 0.2 * vx
    vy = 0.8 * (dy / dt) + 0.2 * vy

    lastX = e.clientX
    lastY = e.clientY
    lastT = e.timeStamp
    e.preventDefault()
  }

  const glide = () => {
    let prev = performance.now()
    const step = () => {
      const now = performance.now()
      const dt = Math.min(32, now - prev)
      prev = now

      win.scrollBy(-vx * dt, -vy * dt)
      vx *= FRICTION
      vy *= FRICTION

      if (Math.hypot(vx, vy) < MIN_VELOCITY) {
        momentumId = null
        return
      }
      momentumId = win.requestAnimationFrame(step)
    }
    momentumId = win.requestAnimationFrame(step)
  }

  const endDrag = () => {
    if (!dragging) return
    dragging = false
    pointerId = null
    doc.documentElement.classList.remove('mp-dragging')
    if (decided && Math.hypot(vx, vy) >= MIN_VELOCITY) glide()
    decided = false
  }

  // A click that follows a real drag shouldn't activate the link underneath.
  const onClick = (e) => {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) >= DRAG_THRESHOLD) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const onDragStart = (e) => e.preventDefault() // kill native image/text dragging

  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
  doc.addEventListener('pointerup', endDrag, true)
  doc.addEventListener('pointercancel', endDrag, true)
  doc.addEventListener('click', onClick, true)
  doc.addEventListener('dragstart', onDragStart, true)

  return {
    ok: true,
    detach() {
      stopMomentum()
      doc.removeEventListener('pointerdown', onPointerDown, true)
      doc.removeEventListener('pointermove', onPointerMove, { capture: true })
      doc.removeEventListener('pointerup', endDrag, true)
      doc.removeEventListener('pointercancel', endDrag, true)
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('dragstart', onDragStart, true)
      style.remove()
    },
  }
}
