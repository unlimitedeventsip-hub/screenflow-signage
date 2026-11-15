// TV media recovery limits. Keep retries finite to avoid hammering Storage
// when a single broken image or MP4 is the entire playlist.
export const VIDEO_BUFFER_TIMEOUT_MS = 20000;

export function mediaRetryDelayMs(consecutiveFailures) {
  const failures = Math.max(1, Math.min(6, Math.floor(Number(consecutiveFailures) || 1)));
  return Math.min(30000, 1500 * 2 ** (failures - 1));
}
