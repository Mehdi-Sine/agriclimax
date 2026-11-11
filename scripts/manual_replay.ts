/** Recalculate captured AGRO inputs without any database or provider access. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {replayIndicators,type CapturedInputs} from './manual_indicators';
import {hash} from '../apps/web/features/editorial/temporal';
const path=process.argv[2],out=process.argv[3];
if(!path||!out)throw Error('REPLAY_INPUT_AND_OUTPUT_REQUIRED');
const saved=JSON.parse(gunzipSync(readFileSync(path),{maxOutputLength:64*1024**2}).toString()) as {groups:{period:[string,string];inputs:CapturedInputs;input_sha256:string}[]};
const groups=saved.groups.map(g=>{if(hash(g.inputs)!==g.input_sha256)throw Error('REPLAY_INPUT_CHECKSUM');const batch=replayIndicators(g.period,g.inputs);return {period:g.period,input_sha256:g.input_sha256,results_sha256:hash(batch),metrics:batch.metrics};});
writeFileSync(out,JSON.stringify({version:'manual-agro-replay-1',groups,source_requests:0,openai_calls:0},null,2));
console.log(JSON.stringify({groups:groups.length,source_requests:0,openai_calls:0,output:out}));
