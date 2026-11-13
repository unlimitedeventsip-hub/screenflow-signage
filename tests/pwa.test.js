import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function worker(){const events={};vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self:{location:{origin:'https://screenflow.test'},addEventListener:(k,f)=>events[k]=f},URL,Response,Request,Headers});return events;}
async function manifest(query){let response;worker().fetch({request:new Request('https://screenflow.test/manifest.webmanifest?'+query),respondWith:r=>response=r});return (await response).json();}
test('home screen opens the selected venue and preserves a private reservation destination',async()=>{assert.equal((await manifest('venue=altfel-unirii')).start_url,'/manage/altfel-unirii');assert.equal((await manifest('guest=altfel-decebal')).start_url,'/g/altfel-decebal');const token='11111111-1111-4111-8111-111111111111';const m=await manifest('guest=altfel-decebal&reservation='+token);assert.equal(m.start_url,'/g/altfel-decebal?reservation='+token);assert.equal(m.id,'/g/altfel-decebal');});
test('a malformed tracking token is omitted from the install destination',async()=>{assert.equal((await manifest('guest=altfel-decebal&reservation=javascript:alert(1)')).start_url,'/g/altfel-decebal');});
