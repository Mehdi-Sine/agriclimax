import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {unpackWeatherArchive} from './weather-archive-codec';
import actualCycle from '../../data/operational/cycle.json';

describe('Python/TypeScript lossless weather archive interoperability',()=>{
  it('restores every real retained field including NULL and provenance',()=>{
    const raw=readFileSync('../../engine/tests/territories/fixtures/weather-pilot-columnar.json.gz');
    const checksum=readFileSync('../../engine/tests/territories/fixtures/weather-pilot-columnar.json.sha256','utf8').trim();
    expect(unpackWeatherArchive(raw,checksum)).toEqual(actualCycle);
  });
  it('rejects corrupt archives and invalid dictionary indices',()=>{
    const raw=gzipSync(JSON.stringify({archive_version:'pra-weather-columnar-1',count:1,metadata:{},columns:{value:{dictionary:[null],codes:[-1]}}}));
    expect(()=>unpackWeatherArchive(raw,createHash('sha256').update(raw).digest('hex'))).toThrow('ARCHIVE_DICTIONARY');
    expect(()=>unpackWeatherArchive(raw,'a'.repeat(64))).toThrow('ARCHIVE_CHECKSUM');
  });
});
