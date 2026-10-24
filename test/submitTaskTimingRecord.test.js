import test from 'node:test';
import assert from 'node:assert/strict';
import { submitTaskTimingRecord, submitTaskTimingBatch, UploadUnconfirmedError } from '../src/services/submitTaskTimingRecord.js';
const payload = { recordId: 'record-r', operator: '[test] test', goodCount: 3 };
const reply = receipt => ({ ok: true, type: 'cors', json: async () => receipt });
test('requires a matching Sheet receipt and uses a readable simple POST', async () => {
    const receipt = { result: 'success', row: 2, recordId: payload.recordId, supabaseSynced: false };
    const result = await submitTaskTimingRecord('https://example.test', payload, { fetchImpl: async (_url, options) => {
        assert.equal(options.method,'POST');
        assert.equal(options.headers['Content-Type'],'text/plain;charset=UTF-8');
        assert.notEqual(options.mode,'no-cors');
        assert.equal(JSON.parse(options.body).recordId,payload.recordId);
        return reply(receipt);
    } });
    assert.deepEqual(result,receipt); // Sheet is master; mirror retry is allowed.
});
test('rejects opaque, HTTP errors, malformed JSON, mismatched IDs and negative receipts', async () => {
    for (const response of [
        { ok: false }, { ok: true, type: 'opaque' },
        { ok: true, json: async () => { throw Error('bad json'); } },
        reply({result:'error'}),reply({result:'success',recordId:'wrong',row:2}),
        reply({result:'success',recordId:payload.recordId}),
    ]) await assert.rejects(submitTaskTimingRecord('test',payload,{fetchImpl:async()=>response}),UploadUnconfirmedError);
});
test('network errors and timeouts remain unconfirmed and never retry automatically', async () => {
    let calls=0;
    await assert.rejects(submitTaskTimingRecord('test',payload,{fetchImpl:async()=>{calls++;throw Error('offline');}}),UploadUnconfirmedError);
    assert.equal(calls,1);
    await assert.rejects(submitTaskTimingRecord('test',payload,{timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout'))))}),UploadUnconfirmedError);
});
test('dual batch saves only acknowledged sides and never reaches success on partial failure', async () => {
    const confirmed=[]; const right={recordId:'r'},left={recordId:'l'}; let calls=0;
    await assert.rejects(submitTaskTimingBatch('test',[right,left],{onConfirmed:row=>confirmed.push(row.recordId),fetchImpl:async(_url,options)=>{
        calls++;const sent=JSON.parse(options.body);
        if(sent.recordId==='l') throw Error('reply lost');
        return reply({result:'success',recordId:sent.recordId,row:2});
    }}),UploadUnconfirmedError);
    assert.deepEqual(confirmed,['r']);assert.equal(calls,2);
});
test('dual batch completes only after both exact receipts', async () => {
    const confirmed=[];
    await submitTaskTimingBatch('test',[{recordId:'r'},{recordId:'l'}],{onConfirmed:p=>confirmed.push(p.recordId),fetchImpl:async(_url,options)=>reply({result:'success',recordId:JSON.parse(options.body).recordId,row:3})});
    assert.deepEqual(confirmed,['r','l']);
});
