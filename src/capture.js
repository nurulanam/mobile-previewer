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
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30, displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true, // Chromium: pre-selects this tab in the picker
  })
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
 * Map an on-page element to its pixel rect within the captured video frame.
 * Only correct when the captured surface is this tab, which is why Region
 * Capture is preferred and this is just the fallback.
 */
function cropRectFor(el, video) {
  const r = el.getBoundingClientRect()
  const sx = video.videoWidth / window.innerWidth
  const sy = video.videoHeight / window.innerHeight
  const x = Math.max(0, Math.round(r.left * sx))
  const y = Math.max(0, Math.round(r.top * sy))
  return {
    x,
    y,
    w: Math.max(1, Math.min(Math.round(r.width * sx), video.videoWidth - x)),
    h: Math.max(1, Math.min(Math.round(r.height * sy), video.videoHeight - y)),
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

  const surface = track.getSettings().displaySurface
  if (!regionCropped && surface && surface !== 'browser') {
    video.remove()
    stopStream(stream)
    throw new Error('Please choose the "This Tab" option when sharing, so the device frame can be cropped accurately.')
  }

  // With Region Capture the frame *is* the element, so no cropping is needed.
  const rect = regionCropped
    ? { x: 0, y: 0, w: video.videoWidth, h: video.videoHeight }
    : cropRectFor(targetEl, video)

  return { stream, video, rect }
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

/** Grab a single cropped frame and hand back a PNG blob. */
export async function captureScreenshot(targetEl) {
  const { stream, video, rect } = await openCroppedStream(targetEl)
  try {
    // Give the compositor a couple of frames so we don't grab a blank one.
    await new Promise((r) => setTimeout(r, 280))

    const canvas = document.createElement('canvas')
    canvas.width = rect.w
    canvas.height = rect.h
    canvas.getContext('2d').drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)

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
export async function startRecording(targetEl, { onTick } = {}) {
  const { stream, video, rect } = await openCroppedStream(targetEl)

  const canvas = document.createElement('canvas')
  // Even dimensions keep VP8/VP9 encoders happy.
  canvas.width = rect.w - (rect.w % 2)
  canvas.height = rect.h - (rect.h % 2)
  const ctx = canvas.getContext('2d')

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
