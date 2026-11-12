// Creates a compact, landscape cover-frame image on the ADMIN laptop.
// Samsung Tizen 2021 commonly renders HTML video in a hardware overlay, so
// drawImage(video) on the TV can show black. Pre-generated images avoid that.
export function createPortraitVideoPoster(file) {
  return new Promise(function (resolve, reject) {
    var video = document.createElement('video');
    var url = URL.createObjectURL(file);
    var complete = false;
    var requestedSeek = false;
    var timeout = null;
    var seekFallback = null;

    function finish(error, result) {
      if (complete) return;
      complete = true;
      clearTimeout(timeout);
      clearTimeout(seekFallback);
      video.removeAttribute('src');
      try { video.load(); } catch (ignore) {}
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(result);
    }
    function capture() {
      if (complete || video.readyState < 2) return;
      try {
        var w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) throw new Error('Nu se pot citi dimensiunile video.');
        if (h <= w) { finish(null, null); return; }
        var canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        var ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Browserul nu permite pregătirea fundalului video.');
        var ratio = canvas.width / canvas.height;
        var sw = w, sh = w / ratio, sx = 0, sy = (h - sh) / 2;
        if (sh > h) { sh = h; sw = h * ratio; sx = (w - sw) / 2; sy = 0; }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob) finish(new Error('Nu s-a putut genera cadrul JPEG pentru fundal.'));
          else finish(null, blob);
        }, 'image/jpeg', 0.82);
      } catch (error) { finish(error); }
    }

    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.addEventListener('loadedmetadata', function () {
      if (complete) return;
      if (video.videoHeight <= video.videoWidth) { finish(null, null); return; }
      var duration = Number(video.duration);
      var seekTo = Number.isFinite(duration) && duration > 0
        ? Math.min(1, duration * 0.2) : 0;
      if (seekTo > 0.05) {
        requestedSeek = true;
        try { video.currentTime = seekTo; } catch (error) { requestedSeek = false; }
      }
      if (!requestedSeek) {
        if (video.readyState >= 2) capture();
      } else {
        seekFallback = setTimeout(function () {
          if (video.readyState >= 2) capture();
        }, 3500);
      }
    });
    video.addEventListener('loadeddata', function () {
      if (!requestedSeek) capture();
    });
    video.addEventListener('seeked', capture);
    video.addEventListener('error', function () {
      finish(new Error('Videoclipul nu poate fi citit pentru generarea fundalului blurat. Verifică formatul MP4 H.264.'));
    });
    timeout = setTimeout(function () {
      finish(new Error('Generarea cadrului video a expirat. Încearcă un MP4 H.264 mai scurt.'));
    }, 20000);
    video.src = url;
    video.load();
  });
}
