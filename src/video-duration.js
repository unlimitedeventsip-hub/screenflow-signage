// Read the actual MP4 playback duration during upload so synced playlists
// use the file's duration instead of the former 10-second default.
export function readVideoDurationSeconds(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const timer = setTimeout(() => finish(null, 10), 12000);
    function finish(error, result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      try { video.load(); } catch {}
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(result);
    }
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      if (!Number.isFinite(duration) || duration <= 0) finish(null, 10);
      else if (duration > 3600) finish(new Error('Videoclipul depășește limita de 60 de minute.'));
      else finish(null, Math.max(3, Math.ceil(duration)));
    };
    video.onerror = () => finish(new Error('Nu pot citi durata MP4. Folosește H.264/AAC compatibil cu TV.'));
    video.src = url;
    video.load();
  });
}
