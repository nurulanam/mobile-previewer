/**
 * Screenshot + screen recording.
 *
 * The preview is a cross-origin <iframe>, and browsers deliberately forbid
 * reading cross-origin pixels into a <canvas> — `drawImage(iframe)` doesn't
 * exist and libraries like html2canvas can't do it either. The only way to
 * capture what's genuinely rendered is the native Screen Capture API: ask the
 * browser for a stream of this tab, then crop it down to the device frame.
 *
 * Everything here is built on platform APIs — no dependencies.
 */

export const captureSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia

export const recordingSupported = () =>
  captureSupported() && typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream

async function requestDisplayStream() {
  // `displaySurface`/`preferCurrentTab` nudge Chromium towards sharing this
  // tab, which gives the cleanest crop. Firefox has no tab-sharing option and
  // can reject the constraint outright, so fall back to a plain request.
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30, displaySurface: 'browser' },
      audio: false,
      preferCurrentTab: true,
    })
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') throw err
    return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
  }
}

function waitForFirstFrame(video, timeout = 10000) {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(finish)
    else video.addEventListener('loadeddata', finish, { once: true })
    setTimeout(finish, timeout)
  })
}

/**
 * Chromium won't deliver frames for a Region-Captured track unless the video
 * element is actually in the document and playing — `loadedmetadata` never
 * fires on such a track, so we start playback first and wait for a real frame.
 * The caller is responsible for removing the returned element.
 */
async function streamToVideo(stream) {
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  video.style.cssText =
    'position:fixed;left:-99999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
  document.body.appendChild(video)

  try {
    await video.play()
  } catch (err) {
    video.remove()
    throw new Error(`Could not start the capture stream: ${err.message}`)
  }

  await waitForFirstFrame(video)
  if (!video.videoWidth || !video.videoHeight) {
    video.remove()
    throw new Error('The capture stream produced no frames')
  }
  return video
}

/**
 * Work out where the element sits inside the captured frame.
 *
 * Firefox's picker has no "this tab" option, so the surface is a whole window
 * or monitor and the element has to be located relative to that. Rather than
 * trusting `displaySurface` (which browsers report inconsistently) we test the
 * three possible surfaces and keep whichever one the video's dimensions
 * actually match — the scale factors on both axes agree only for the right one.
 */
function cropRectFor(el, video, surfaceHint) {
  const r = el.getBoundingClientRect()

  // Window border thickness and the height of the browser's own chrome,
  // derived from the gap between the outer window and the content viewport.
  const borderX = Math.max(0, (window.outerWidth - window.innerWidth) / 2)
  const chromeTop = Math.max(0, window.outerHeight - window.innerHeight - borderX)

  const candidates = [
    { kind: 'browser', w: window.innerWidth, h: window.innerHeight, x: r.left, y: r.top },
    {
      kind: 'window',
      w: window.outerWidth,
      h: window.outerHeight,
      x: r.left + borderX,
      y: r.top + chromeTop,
    },
    {
      kind: 'monitor',
      w: window.screen.width,
      h: window.screen.height,
      x: window.screenX + borderX + r.left,
      y: window.screenY + chromeTop + r.top,
    },
  ]

  let best = null
  for (const c of candidates) {
    if (!c.w || !c.h) continue
    const sx = video.videoWidth / c.w
    const sy = video.videoHeight / c.h
    // A correct surface scales identically on both axes.
    let error = Math.abs(sx - sy) / Math.max(sx, sy)
    if (surfaceHint && c.kind === surfaceHint) error -= 0.05 // trust the hint as a tie-breaker
    if (!best || error < best.error) best = { ...c, sx, sy, error }
  }

  const x = Math.round(best.x * best.sx)
  const y = Math.round(best.y * best.sy)
  const w = Math.round(r.width * best.sx)
  const h = Math.round(r.height * best.sy)

  // Clamp into the frame so a slightly-off estimate still yields a valid crop.
  const cx = Math.max(0, Math.min(x, video.videoWidth - 1))
  const cy = Math.max(0, Math.min(y, video.videoHeight - 1))
  return {
    x: cx,
    y: cy,
    w: Math.max(1, Math.min(w, video.videoWidth - cx)),
    h: Math.max(1, Math.min(h, video.videoHeight - cy)),
    surface: best.kind,
  }
}

/**
 * Open a capture stream already narrowed to `targetEl`.
 *
 * Region Capture (`CropTarget` + `track.cropTo`) makes the browser itself crop
 * the stream to the element, which stays pixel-accurate no matter how the page
 * scrolls or which surface was picked. Where it isn't available we fall back to
 * cropping by hand against the tab viewport.
 */
async function openCroppedStream(targetEl) {
  const stream = await requestDisplayStream()
  const track = stream.getVideoTracks()[0]

  let regionCropped = false
  try {
    if (window.CropTarget?.fromElement && typeof track.cropTo === 'function') {
      await track.cropTo(await window.CropTarget.fromElement(targetEl))
      regionCropped = true
    }
  } catch {
    /* not supported for this surface — hand-crop instead */
  }

  let video
  try {
    video = await streamToVideo(stream)
  } catch (err) {
    stopStream(stream)
    throw err
  }

  // With Region Capture the frame *is* the element, so no cropping is needed.
  // Otherwise (Firefox, Safari) locate the element within the captured surface.
  const rect = regionCropped
    ? { x: 0, y: 0, w: video.videoWidth, h: video.videoHeight, surface: 'region' }
    : cropRectFor(targetEl, video, track.getSettings().displaySurface)

  return { stream, video, rect, exact: regionCropped }
}

function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop())
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Grab a single cropped frame and hand back a PNG blob.
 *
 * Chrome hands back a different capture resolution from run to run, so the
 * frame is always rescaled to `outputWidth`/`outputHeight` — normally the
 * device's own viewport — giving a predictable, exactly-sized export.
 */
export async function captureScreenshot(targetEl, { outputWidth, outputHeight } = {}) {
  const { stream, video, rect } = await openCroppedStream(targetEl)
  try {
    // Give the compositor a couple of frames so we don't grab a blank one.
    await new Promise((r) => setTimeout(r, 280))

    const outW = Math.max(1, Math.round(outputWidth || rect.w))
    const outH = Math.max(1, Math.round(outputHeight || rect.h))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, outW, outH)

    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding the PNG failed'))), 'image/png')
    )
  } finally {
    video.remove()
    stopStream(stream)
  }
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

/**
 * Record the device frame region. Returns a handle with `stop()` resolving to
 * the finished blob, so the caller controls when recording ends.
 */
export async function startRecording(targetEl, { onTick, outputWidth, outputHeight } = {}) {
  const { stream, video, rect } = await openCroppedStream(targetEl)

  const wantW = Math.round(outputWidth || rect.w)
  const wantH = Math.round(outputHeight || rect.h)

  const canvas = document.createElement('canvas')
  // Even dimensions keep VP8/VP9 encoders happy.
  canvas.width = Math.max(2, wantW - (wantW % 2))
  canvas.height = Math.max(2, wantH - (wantH % 2))
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  let rafId = null
  const draw = () => {
    ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height)
    rafId = requestAnimationFrame(draw)
  }
  draw()

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(canvas.captureStream(30), {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 6_000_000,
  })
  const chunks = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  const startedAt = performance.now()
  const tick = onTick && setInterval(() => onTick(performance.now() - startedAt), 250)

  // If the user ends the share from the browser's own capture bar, wrap up.
  const finished = new Promise((resolve) => {
    recorder.onstop = () => {
      cancelAnimationFrame(rafId)
      clearInterval(tick)
      video.remove()
      stopStream(stream)
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
    }
  })
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    if (recorder.state !== 'inactive') recorder.stop()
  })

  recorder.start(200)

  return {
    extension: (recorder.mimeType || 'video/webm').includes('mp4') ? 'mp4' : 'webm',
    stop() {
      if (recorder.state !== 'inactive') recorder.stop()
      return finished
    },
  }
}
