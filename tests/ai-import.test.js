import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAIImport,aiPrompt} from '../src/ai-import.js';
const quiz={version:1,type:'quiz',title:'Cinema',questions:[{text:'Care?',options:['A','B'],correct:1,seconds:25}]};
test('AI imports accept fenced JSON but never execute code',()=>{assert.equal(parseAIImport('```json\n'+JSON.stringify(quiz)+'\n```').questions[0].correct,1);assert.throws(()=>parseAIImport('alert(1)'));assert.throws(()=>parseAIImport('<script>1</script>'));});
test('Quiz validation rejects invalid answer indexes, duplicate choices, excessive time and oversized input',()=>{for(const question of [{...quiz.questions[0],correct:4},{...quiz.questions[0],options:['A','A']},{...quiz.questions[0],seconds:3}])assert.throws(()=>parseAIImport(JSON.stringify({...quiz,questions:[question]})));assert.throws(()=>parseAIImport(' '.repeat(100001)));});
test('Menu import keeps prices supplied by the operator, and permits unknown values',()=>{const result=parseAIImport(JSON.stringify({version:1,type:'content',items:[{title:'Cafea',subtitle:'12 lei',category:'Cafea'},{title:'Ceai'}]}),'menu');assert.equal(result.items[0].subtitle,'12 lei');assert.equal(result.items[1].subtitle,'');assert.match(aiPrompt('meniul nostru','menu'),/Nu inventa prețuri/);});
