import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {verifyBundle,sealBundle,sealMap,mapInfo,type EditionMapBundle} from './model';
import {thumbnailSvg} from '../../lib/server/map-thumbnail';
const original=JSON.parse(gunzipSync(readFileSync(new URL('../../../../docs/codex/INT-01/evidence/real-map-bundle.json.gz',import.meta.url))).toString()) as EditionMapBundle;
const edition={edition_id:original.edition_id,checksum:original.edition_checksum,date:original.edition_date};
it('keeps old archive identities and rejects an attachment bound to a different support or nature',()=>{
 expect(verifyBundle(original,edition)).toBe(original);
 const old=JSON.stringify(original);
 const bundle=structuredClone(original);
 const map=bundle.maps.find(m=>m.nature==='reanalysis')!;
 const row=map.rows.find(r=>r.quality?.evidence.support_id)!;
 const feature={type:'Feature' as const,id:row.territoryId,properties:{code:row.territoryId.slice(4),name:'test',department_name:'test',region_name:'test',support_id:row.quality!.evidence.support_id!},geometry:{type:'Polygon' as const,coordinates:[[[0,45],[1,45],[1,46],[0,45]]]}};
 map.rendering={version:'couv06-history-1',covered_support:{type:'FeatureCollection',features:[feature]}};
 const reseal=()=>{
  const {id,...body}=map;void id;Object.assign(map,sealMap(body));
  const {sha256,...b}=bundle;void sha256;return sealBundle(b);
 };
 expect(verifyBundle(reseal(),edition).maps.find(m=>m.id===map.id)?.rendering?.version).toBe('couv06-history-1');
 expect(mapInfo(map)).not.toHaveProperty('rendering');
 feature.properties.support_id='different-period';
 expect(()=>verifyBundle(reseal(),edition)).toThrow('MAP_HISTORICAL_GEOMETRY_BINDING');
 feature.properties.support_id=row.quality!.evidence.support_id!;
 map.nature='forecast';map.cycles=['2026-11-01T00:00:00Z'];
 expect(()=>verifyBundle(reseal(),edition)).toThrow('MAP_HISTORICAL_RENDERING');
 expect(JSON.stringify(original)).toBe(old);
});
it('preserves original raster and 713 outlines for a new versioned historical rendering',()=>{
 const map=original.maps.find(m=>m.nature==='reanalysis')!;
 const before=thumbnailSvg(map);
 const svg=thumbnailSvg(map,{exhaustive:true,coveredSupport:{type:'FeatureCollection',features:[]}});
 expect(svg.match(/data-pra-outline=/g)).toHaveLength(713);
 expect(thumbnailSvg(map)).toBe(before);
});
