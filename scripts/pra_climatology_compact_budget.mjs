// Local PostgreSQL measurement on exported real Task21 rows; sources stay outside Postgres.
// Install @electric-sql/pglite@0.3.14 in a temporary directory; pass its module URL as argv[2].
import fs from 'node:fs';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const pg = new PGlite();
const source = JSON.parse(fs.readFileSync('work/task22/task21-export.json'))[0].payload;
await pg.exec(`create table compact (
 release_id integer not null, pra_id text not null, day smallint not null,
 tmin real,tmax real,tmean real,rain real,
 nmin smallint not null,nmax smallint not null,nmean smallint not null,nrain smallint not null,
 primary key(release_id,pra_id,day));`);
await pg.query(`insert into compact
 select 1,pra_id,extract(doy from ('2000-'||period)::date)::smallint,
 max(value) filter(where variable=0),max(value) filter(where variable=1),
 max(value) filter(where variable=2),max(value) filter(where variable=3),
 max(n) filter(where variable=0),max(n) filter(where variable=1),
 max(n) filter(where variable=2),max(n) filter(where variable=3)
 from jsonb_to_recordset($1::jsonb) x(pra_id text,period text,variable int,value real,n smallint)
 group by pra_id,period order by pra_id,period`,
 [JSON.stringify(source.rows.map(r => ({pra_id:r[0],period:r[1],variable:r[2],value:r[3],n:r[4]})))]);
const measured = (await pg.query(`select count(*) rows,pg_relation_size('compact') heap_bytes,
 pg_indexes_size('compact') index_bytes,pg_total_relation_size('compact') total_bytes from compact`)).rows[0];
if (Number(measured.rows) !== 713 * 30) throw Error('Task21 data incomplete');
const perDay = measured.total_bytes / Number(measured.rows);
const baseline = 88987315;
const projected = baseline + perDay * 713 * 366 * 1.5 + 30000000 + 1000000;
const out = {
 engine:'PGlite PostgreSQL 17 local WASM',source:'actual immutable Task21 daily aggregates',
 ...measured, bytes_per_pra_day:perDay, annual_rows_365:713*365, annual_rows_366:713*366,
 annual_bytes:Math.ceil(perDay*713*366), database_baseline:baseline, margin:0.5,
 growth_reserve:30000000,metadata_reserve:1000000,
 projected_total_database_bytes:Math.ceil(projected), ceiling:375000000, validated:projected<200000000,
};
fs.mkdirSync('docs/codex/verification/task22',{recursive:true});
fs.writeFileSync('docs/codex/verification/task22/storage-budget.json',JSON.stringify(out,null,2)+'\n');
console.log(out);
await pg.close();
