import test from 'node:test';import assert from 'node:assert/strict';import {parseGroundedAnswer} from '../src/lib/askResponse.ts';
const encode=(answer,supported=true)=>JSON.stringify({answer,supported});
test('renumbers only actual citations in first-use order',()=>assert.deepEqual(parseGroundedAnswer(encode('First [3], then [1], again [3].'),3),{kind:'answered',answer:'First [1], then [2], again [1].',order:[3,1]}));
test('rejects unsupported citation numbers',()=>{for(const answer of ['Unknown [99]','Zero [0]','Mixed [1][9]'])assert.equal(parseGroundedAnswer(encode(answer),3).kind,'invalid');});
test('does not attach fabricated sources to uncited prose',()=>assert.equal(parseGroundedAnswer(encode('An uncited claim.'),3).kind,'invalid'));
test('valid abstention never cites sources',()=>assert.deepEqual(parseGroundedAnswer(encode('Not answered.',false),3),{kind:'unsupported'}));
test('rejects malformed JSON and unexpected answer types',()=>{for(const raw of ['not JSON','{}','null',JSON.stringify({answer:42,supported:true}),JSON.stringify({answer:'',supported:true}),JSON.stringify({answer:'Claim [1]'})])assert.equal(parseGroundedAnswer(raw,3).kind,'invalid');});
