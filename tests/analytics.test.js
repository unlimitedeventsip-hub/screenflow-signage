import test from 'node:test';
import assert from 'node:assert/strict';
import {attributionSource,ANALYTICS_CONSENT_KEY} from '../src/analytics.js';

test('QR analytics only trusts an explicit QR attribution label',()=>{
 assert.equal(attributionSource('?src=tvqr'),'tv_qr');
 assert.equal(attributionSource('?src=printqr'),'print_qr');
 assert.equal(attributionSource('?src=shared'),'shared');
 assert.equal(attributionSource(''),'direct');
 assert.equal(attributionSource('?src=untrusted'),'direct');
 assert.equal(attributionSource('?reservation=private-secret'),'direct');
});
test('analytics consent preference has a versioned private key',()=>{
 assert.match(ANALYTICS_CONSENT_KEY,/analytics:consent:v\d+$/);
});
