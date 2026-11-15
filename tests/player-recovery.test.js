import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaRetryDelayMs, VIDEO_BUFFER_TIMEOUT_MS, playerDiagnosticError, isLegacyProgressMessage} from '../src/player-recovery.js';

test('TV buffer watchdog has a bounded timeout', () => {
  assert.equal(VIDEO_BUFFER_TIMEOUT_MS, 20000);
});

test('failed media retries back off and stop increasing beyond 30 seconds', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(mediaRetryDelayMs),
    [1500, 3000, 6000, 12000, 24000, 30000, 30000]);
});

test('bad retry counters do not cause immediate infinite retries', () => {
  for (const input of [0, -10, NaN, undefined, 'invalid']) {
    assert.equal(mediaRetryDelayMs(input), 1500);
  }
});

test('successful offline cache updates are never reported as playback errors', () => {
  for (const msg of ['Pregătire offline…','Salvare offline: 3/4','Offline pregătit: 17/17 · fișiere verificate','OFFLINE · Redare din memoria TV']) {
    assert.equal(playerDiagnosticError('',msg),'');
    assert.equal(isLegacyProgressMessage(msg),true);
  }
});

test('actual playback failures remain visible in TV diagnostics', () => {
  assert.match(playerDiagnosticError('Video blocat la încărcare','Offline pregătit: 3/3'),/Video blocat/);
  assert.match(playerDiagnosticError('','Offline incomplet: 2/4'),/Offline incomplet/);
  assert.match(playerDiagnosticError('','Offline indisponibil: fișier lipsă'),/Offline indisponibil/);
  assert.equal(playerDiagnosticError('Video: pornire în 3.5 secunde','Offline pregătit: 3/3'),'');
});
