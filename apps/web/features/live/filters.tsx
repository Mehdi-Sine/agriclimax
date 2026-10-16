'use client';
import { useState } from 'react';
import { INDICATORS, STAGES } from '../wheat/model';
import { CATTLE_INDICATORS } from './context';
export function LiveFilters({action, production, indicator, start, end, station, stations, product, stage, fingerprint}: {
  action:string; production:string; indicator:string; start:string; end:string; station:string;
  stations:{id:string; name:string}[]; product:string; stage:string; fingerprint:string;
}) {
  const [crop, setCrop] = useState(production);
  const [metric, setMetric] = useState(indicator);
  return <form action={action} className="live-filters">
    <input type="hidden" name="mode" value="live_meteofrance" />
    <div className="field"><label htmlFor="live-production">Production</label><select id="live-production" name="production" value={crop} onChange={e => {setCrop(e.target.value); setMetric(e.target.value === 'cattle' ? 'thi' : 'gdd');}}><option value="wheat">Blé tendre</option><option value="cattle">Bovins</option></select></div>
    <div className="field"><label htmlFor="live-indicator">Indicateur</label><select id="live-indicator" name="indicator" value={metric} onChange={e => setMetric(e.target.value)}>{Object.entries(crop === 'cattle' ? CATTLE_INDICATORS : INDICATORS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    <label className="field">Début inclus<input type="date" name="start" required defaultValue={start} /></label>
    <label className="field">Fin incluse<input type="date" name="end" required defaultValue={end} /></label>
    <div className="field"><label htmlFor="live-station">Station</label><select id="live-station" name="station" defaultValue={station}><option value="">{crop === 'cattle' ? 'Station par défaut · 29075001' : 'Toutes les stations publiées'}</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name} · {s.id}</option>)}{station && !stations.some(s=>s.id===station) && <option value={station}>{station} · hors catalogue reçu</option>}</select></div>
    {crop === 'cattle' ? <div className="field"><label htmlFor="live-product">Support temporel</label><select id="live-product" name="product" defaultValue={product}><option value="auto">Horaire complet sinon quotidien synthétique</option><option value="climatology">Quotidien synthétique · TM + UM</option><option value="observations">Échantillons horaires</option></select></div> : <>
      <div className="field"><label htmlFor="live-stage">Fenêtre phénologique</label><select id="live-stage" name="stage" defaultValue={stage}><option value="">Calendrier explicite · aucun stade déduit</option>{Object.entries(STAGES).map(([id, label])=><option key={id} value={id}>{label} · fourni explicitement</option>)}</select></div>
      {fingerprint && <input type="hidden" name="fingerprint" value={fingerprint} />}
    </>}
    <button className="button button-primary" type="submit">Afficher</button>
  </form>;
}
