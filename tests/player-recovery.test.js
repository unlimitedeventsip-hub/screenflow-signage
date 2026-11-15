import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaRetryDelayMs, VIDEO_BUFFER_TIMEOUT_MS} from '../src/player-recovery.js';

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
