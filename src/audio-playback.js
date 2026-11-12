// Audio output for Screenflow TV players (Samsung Tizen, Android TV, web).
// Audio is OFF by default until enabled for an individual playlist in Admin.
// Background music plays over images only and pauses for videos.
export function createAudioPlayback({ stage, indicator, getUrl }) {
  const bg = document.createElement('audio');
  bg.loop = false; // Multi-part MP3 loops across segments
  bg.preload = 'auto';
  bg.setAttribute('aria-hidden', 'true');
  bg.className = 'tv-background-audio';
  document.body.appendChild(bg);

  const unlock = document.createElement('button');
  unlock.type = 'button';
  unlock.className = 'tv-audio-unlock';
  unlock.textContent = '🔊 Activează sunetul · OK';
  unlock.hidden = true;
  document.body.appendChild(unlock);

  const defaults = {
    video_audio_enabled: false, video_volume: 35,
    background_audio_enabled: false, background_volume: 25,
    background_track_path: null
  };
  let settings = defaults;
  let audioPath = '';
  let partPaths = [];
  let partIndex = 0;
  let currentMedia = 'none';

  function nextMusicPart() {
    if (!partPaths.length) return;
    partIndex = (partIndex + 1) % partPaths.length;
    bg.src = getUrl(partPaths[partIndex]);
    if (currentMedia === 'image' && settings.background_audio_enabled && !document.hidden) playMusic();
  }
  bg.addEventListener('ended', nextMusicPart);

  function volume(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : fallback / 100;
  }
  function showUnlock() {
    if (document.hidden) return;
    unlock.hidden = false;
    indicator.textContent = 'Sunetul a fost blocat la pornire. Apasă OK pe telecomandă.';
  }
  function hideUnlock() {
    unlock.hidden = true;
    if (indicator.textContent.indexOf('Sunetul a fost blocat') === 0) indicator.textContent = '';
  }
  function pauseMusic() {
    if (!bg.paused) bg.pause();
  }
  function playMusic() {
    if (currentMedia !== 'image' || document.hidden || !settings.background_audio_enabled ||
        !partPaths.length || volume(settings.background_volume, 25) === 0) {
      pauseMusic();
      return;
    }
    bg.volume = volume(settings.background_volume, 25);
    const request = bg.play();
    if (request && typeof request.then === 'function') {
      request.then(hideUnlock).catch(showUnlock);
    }
  }
  function prepareVideo(video) {
    currentMedia = 'video';
    pauseMusic();
    const enabled = Boolean(settings.video_audio_enabled) && volume(settings.video_volume, 35) > 0;
    video.muted = !enabled;
    video.volume = volume(settings.video_volume, 35);
    return video.play().then(function () { if (enabled) hideUnlock(); }).catch(function (err) {
      if (!enabled) throw err;
      // Browsers may forbid autoplay with sound. Keep the ad running silently
      // and offer a one-key gesture to enable audio, rather than skipping it.
      video.muted = true;
      return video.play().then(showUnlock);
    });
  }
  function mediaChanged(kind) {
    currentMedia = kind;
    if (kind === 'image') playMusic();
    else pauseMusic();
  }
  function applySettings(data) {
    const chunks = Array.isArray(data.background_track_parts)
      ? data.background_track_parts.filter(v => typeof v === 'string' && v.indexOf('audio/') === 0)
      : [];
    if (!chunks.length && typeof data.background_track_path === 'string' && data.background_track_path) {
      chunks.push(data.background_track_path);
    }
    settings = {
      video_audio_enabled: Boolean(data.video_audio_enabled),
      video_volume: data.video_volume == null ? 35 : data.video_volume,
      background_audio_enabled: Boolean(data.background_audio_enabled),
      background_volume: data.background_volume == null ? 25 : data.background_volume,
      background_track_path: data.background_track_path || null,
      background_track_parts: chunks
    };
    const newParts = settings.background_audio_enabled ? chunks : [];
    const key = JSON.stringify(newParts);
    if (audioPath !== key) {
      pauseMusic();
      audioPath = key;
      partPaths = newParts;
      partIndex = 0;
      if (partPaths.length) bg.src = getUrl(partPaths[0]);
      else { bg.removeAttribute('src'); bg.load(); }
    }
    bg.volume = volume(settings.background_volume, 25);
    const video = stage.querySelector('video.tv-media');
    if (video) {
      const enabled = Boolean(settings.video_audio_enabled) && volume(settings.video_volume, 35) > 0;
      video.volume = volume(settings.video_volume, 35);
      video.muted = !enabled;
    } else if (currentMedia === 'image') playMusic();
    if (!settings.video_audio_enabled && !settings.background_audio_enabled) hideUnlock();
  }
  function activateSound() {
    // Real user gesture: Samsung remote OK, click, or pointer activation.
    const video = stage.querySelector('video.tv-media');
    if (video && settings.video_audio_enabled) {
      video.muted = false;
      video.volume = volume(settings.video_volume, 35);
      const attempt = video.play();
      if (attempt && typeof attempt.then === 'function') attempt.then(hideUnlock).catch(showUnlock);
      else hideUnlock();
    } else if (settings.background_audio_enabled && currentMedia === 'image') {
      playMusic();
    } else hideUnlock();
  }

  unlock.addEventListener('click', activateSound);
  document.addEventListener('keydown', function (event) {
    if (!unlock.hidden && (event.keyCode === 13 || event.keyCode === 32)) activateSound();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseMusic();
    else if (currentMedia === 'image') playMusic();
  });
  window.addEventListener('online', function () {
    if (currentMedia === 'image') playMusic();
  });

  return { applySettings, prepareVideo, mediaChanged, pauseMusic };
}
