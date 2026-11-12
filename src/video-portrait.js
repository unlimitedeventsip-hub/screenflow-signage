// Portrait video backdrop for Samsung Tizen 6 / Android TV / browsers.
// Copies a few frames per second from the *single* foreground video into a
// low-resolution, blurred canvas. This avoids decoding two independent videos.
export function attachPortraitBackdrop(stage, video) {
  let stopped = false;
  let canvas = null;
  let context = null;
  let timer = null;
  let drawingUnsupported = false;
  const width = 384;
  const height = 216;

  function draw() {
    timer = null;
    if (stopped || drawingUnsupported || !canvas || !stage.contains(video)) return;
    if (!document.hidden && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const targetRatio = width / height;
        const sourceRatio = vw / vh;
        let sx = 0, sy = 0, sw = vw, sh = vh;
        if (sourceRatio < targetRatio) {
          sh = vw / targetRatio;
          sy = (vh - sh) / 2;
        } else {
          sw = vh * targetRatio;
          sx = (vw - sw) / 2;
        }
        // We do not inspect/read back pixels, so cross-origin canvas taint is
        // harmless; the public video URL is only drawn to the display canvas.
        context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
      } catch (error) {
        // Some hardware overlays cannot be copied into a 2D canvas. Keep
        // the primary advertisement playing; never attempt a second decoder.
        drawingUnsupported = true;
        if (window.console && console.warn) console.warn('Screenflow portrait backdrop unavailable:', error);
        return;
      }
    }
    timer = setTimeout(draw, 200);
  }

  function ready() {
    if (stopped || canvas || !video.videoWidth || !video.videoHeight) return;
    if (video.videoHeight <= video.videoWidth) return; // Landscape: unchanged
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = 'tv-portrait-backdrop';
    canvas.setAttribute('aria-hidden', 'true');
    context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    // Insert behind the original (and only audible) video.
    stage.insertBefore(canvas, video);
    stage.classList.add('tv-stage-portrait');
    draw();
  }

  video.addEventListener('loadedmetadata', ready);
  if (video.readyState >= 1) ready();

  return function cleanup() {
    stopped = true;
    clearTimeout(timer);
    video.removeEventListener('loadedmetadata', ready);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    stage.classList.remove('tv-stage-portrait');
  };
}
