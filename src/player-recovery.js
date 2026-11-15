// TV media recovery limits. Keep retries finite to avoid hammering Storage
// when a single broken image or MP4 is the entire playlist.
export const VIDEO_BUFFER_TIMEOUT_MS = 20000;

export function mediaRetryDelayMs(consecutiveFailures) {
  const failures = Math.max(1, Math.min(6, Math.floor(Number(consecutiveFailures) || 1)));
  return Math.min(30000, 1500 * 2 ** (failures - 1));
}

// Supabase's tv_playback_audit treats any nonempty error_message as an
// incident. Progress/success text must NEVER be sent as a playback error.
export function playerDiagnosticError(videoStatus='',offlineStatus='') {
  const video=String(videoStatus||'').trim();
  if (video && !/^Video: pornire în \d/i.test(video)) return video.slice(0,140);
  const cache=String(offlineStatus||'').trim();
  if (/^(?:Offline incomplet|Offline indisponibil|Offline:)/i.test(cache)) return cache.slice(0,140);
  return '';
}
