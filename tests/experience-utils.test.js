import test from 'node:test';
import assert from 'node:assert/strict';
import {httpsLink,escapeHTML,isScheduled,localReservationDate,bucharestNow} from '../src/experience-utils.js';
test('public links reject executable schemes, cleartext and embedded credentials',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hi','http://example.org','https://user:password@example.org','not a url'])assert.equal(httpsLink(url),'');
 assert.equal(httpsLink('https://www.instagram.com/altfel_unirii/'),'https://www.instagram.com/altfel_unirii/');
 assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
test('Friday overnight menu inherits Friday after midnight in Bucharest',()=>{
 const item={weekdays:[5],daily_start:'22:00',daily_end:'03:00'};
 assert.equal(isScheduled(item,new Date('2026-11-13T21:00:00Z')),true);
 assert.equal(isScheduled(item,new Date('2026-11-14T00:59:00Z')),true);
 assert.equal(isScheduled(item,new Date('2026-11-14T01:00:00Z')),false);
 assert.equal(isScheduled(item,new Date('2026-11-14T21:00:00Z')),false);
});
test('campaign start and end boundaries apply before a recurring schedule',()=>{
 const item={starts_at:'2026-11-13T16:00:00Z',ends_at:'2026-11-13T18:00:00Z'};
 assert.equal(isScheduled(item,new Date('2026-11-13T15:59:59Z')),false);
 assert.equal(isScheduled(item,new Date('2026-11-13T16:00:00Z')),true);
 assert.equal(isScheduled(item,new Date('2026-11-13T18:00:00Z')),false);
});
test('Bucharest clock follows summer and winter offsets, independent of host timezone',()=>{
 assert.equal(bucharestNow(new Date('2026-07-01T12:00:00Z')).time,'15:00');
 assert.equal(bucharestNow(new Date('2026-11-13T12:00:00Z')).time,'14:00');
 assert.equal(localReservationDate('2026-11-15T20:30'),'2026-11-15 20:30:00');
 assert.equal(localReservationDate('2026-11-15T20:30Z'),'');
});
