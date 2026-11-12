// Portrait video backgrounds for Samsung Tizen / Android TV / web.
//
// Samsung TV uses a hardware video plane (video hole). Drawing video frames
// to Canvas can yield black. We display the pre-generated JPEG in SIDE PANELS
// only, leaving the middle clear for the single foreground hardware video.
// Other browsers can progressively enhance the sides with a live low-res Canvas.
export function attachPortraitBackdrop(stage, video, posterUrl) {
  var stopped = false;
  var attached = false;
  var canvas = null;
  var context = null;
  var timer = null;
  var sides = null;
  var left = null;
  var right = null;
  var width = 384, height = 216;
  var isTizen = /Tizen/i.test(navigator.userAgent || '');

  function layout() {
    if (stopped || !attached || !video.videoWidth || !video.videoHeight) return;
    var w = stage.clientWidth || window.innerWidth;
    var h = stage.clientHeight || window.innerHeight;
    var mainWidth = Math.max(1, Math.min(w, h * video.videoWidth / video.videoHeight));
    var gutter = Math.max(0, (w - mainWidth) / 2);
    // Critical for Tizen hardware video planes: the VIDEO ELEMENT itself must
    // have portrait dimensions. object-fit:contain on a fullscreen video leaves
    // black letterboxing inside the video plane and covers the blurred sides.
    video.style.setProperty('width', Math.round(mainWidth) + 'px', 'important');
    video.style.setProperty('height', Math.round(h) + 'px', 'important');
    video.style.setProperty('max-width', 'none', 'important');
    video.style.setProperty('flex', '0 0 auto', 'important');
    video.width = Math.round(mainWidth);
    video.height = Math.round(h);
    left.style.width = Math.ceil(gutter) + 'px';
    right.style.width = Math.ceil(gutter) + 'px';
  }

  function draw() {
    timer = null;
    if (stopped || !canvas || !stage.contains(video)) return;
    if (!document.hidden && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      try {
        var vw = video.videoWidth, vh = video.videoHeight;
        var target = width / height;
        var sw = vw, sh = vw / target, sx = 0, sy = (vh - sh) / 2;
        if (sh > vh) { sh = vh; sw = vh * target; sx = (vw - sw) / 2; sy = 0; }
        context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
        canvas.classList.add('tv-portrait-backdrop-ready');
      } catch (error) {
        // The poster remains as the fallback, and the foreground keeps playing.
        if (window.console && console.warn) console.warn('Live blurred video unavailable:', error);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        return;
      }
    }
    timer = setTimeout(draw, 220);
  }

  function createSide(sideName) {
    var panel = document.createElement('div');
    panel.className = 'tv-portrait-side tv-portrait-' + sideName;
    if (posterUrl) {
      var img = document.createElement('img');
      img.src = posterUrl;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      panel.appendChild(img);
    }
    return panel;
  }

  function ready() {
    if (stopped || attached || !video.videoWidth || !video.videoHeight) return;
    if (video.videoHeight <= video.videoWidth) return; // Landscape unchanged.
    attached = true;
    stage.classList.add('tv-stage-portrait');

    // Empty panels retain an attractive gradient for old ads without posters.
    sides = document.createElement('div');
    sides.className = 'tv-portrait-sides';
    left = createSide('left');
    right = createSide('right');
    sides.appendChild(left);
    sides.appendChild(right);
    stage.insertBefore(sides, video);
    layout();

    // Do not attempt a Canvas copy on Samsung hardware video overlays.
    // Video must not be decoded twice on this TV.
    if (isTizen) return;

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = 'tv-portrait-backdrop';
    canvas.setAttribute('aria-hidden', 'true');
    context = canvas.getContext('2d', { alpha: false });
    if (!context) { canvas = null; return; }
    // Canvas stays behind the main video, and only becomes visible once
    // the first successful frame has been drawn.
    stage.insertBefore(canvas, video);
    draw();
  }

  video.addEventListener('loadedmetadata', ready);
  window.addEventListener('resize', layout);
  if (video.readyState >= 1) ready();

  return function cleanup() {
    stopped = true;
    clearTimeout(timer);
    video.removeEventListener('loadedmetadata', ready);
    window.removeEventListener('resize', layout);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (sides && sides.parentNode) sides.parentNode.removeChild(sides);
    stage.classList.remove('tv-stage-portrait');
    video.style.removeProperty('width');
    video.style.removeProperty('height');
    video.style.removeProperty('max-width');
    video.style.removeProperty('flex');
  };
}
