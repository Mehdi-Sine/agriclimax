import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

export type JsonRecord=Record<string,unknown>;
export function record(value:unknown):value is JsonRecord{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export function unpackWeatherArchive(content:Uint8Array,checksum:string):JsonRecord {
  if(!/^[a-f0-9]{64}$/.test(checksum)||createHash('sha256').update(content).digest('hex')!==checksum)throw new Error('ARCHIVE_CHECKSUM');
  const raw:unknown=JSON.parse(gunzipSync(content,{maxOutputLength:32*1024**2}).toString('utf8'));
  if(!record(raw)||raw.archive_version!=='pra-weather-columnar-1'||typeof raw.count!=='number'||!Number.isInteger(raw.count)||raw.count<1||raw.count>100000||!record(raw.metadata)||!record(raw.columns))throw new Error('ARCHIVE_CONTRACT');
  const count=raw.count,rows:JsonRecord[]=Array.from({length:count},()=>({}));
  for(const [key,column] of Object.entries(raw.columns)){
    if(['__proto__','constructor','prototype'].includes(key)||!record(column))throw new Error('ARCHIVE_COLUMN');
    let values:unknown[];
    if(Array.isArray(column.values))values=column.values;
    else{
      const dictionary=column.dictionary,codes=column.codes;
      if(!Array.isArray(dictionary)||!Array.isArray(codes)||!codes.every((c):c is number=>typeof c==='number'&&Number.isInteger(c)&&c>=0&&c<dictionary.length))throw new Error('ARCHIVE_DICTIONARY');
      values=codes.map(c=>dictionary[c]);
    }
    if(values.length!==count)throw new Error('ARCHIVE_COUNT');
    for(let i=0;i<count;i++)rows[i][key]=values[i];
  }
  return {...raw.metadata,rows};
}
