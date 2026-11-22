"use client";

import { useResource } from "../unified/resource";
import type { Profile } from "./situations";

export function AgriculturalProfile({ pra }: { pra: string }) {
  const resource = useResource<Profile>(`/api/veille/productions?pra=${encodeURIComponent(pra)}`, true);
  const profile = resource.data;
  const present = profile?.crops.filter(c => c.hectares !== null && c.hectares > 0) ?? [];
  const incomplete = profile?.crops.some(c => c.hectares === null);
  return (
    <section aria-label="Productions agricoles associées à la PRA">
      <h3>Productions agricoles associées</h3>
      {resource.error ? <p role="alert">Profil agricole temporairement indisponible.</p> :
        !profile ? <p role="status">Lecture du profil agricole…</p> : <>
          {present.length > 0 ? <>
            <p>Surfaces déclarées par groupe · RPG 2025</p>
            <ul>{present.map((crop, index) => <li key={crop.id}>
              {crop.label} · {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(crop.hectares!)} ha
              {index === 0 && !incomplete ? " (premier groupe parmi ceux présentés)" : ""}
            </li>)}</ul>
          </> : <p>Aucune surface positive documentée dans les groupes présentés.</p>}
          {incomplete && <p>Couverture RPG incomplète pour certains groupes.</p>}
          <p>Orientations d’élevage · échantillon OTEX 2020</p>
          <p>{profile.orientations.length ? profile.orientations.map(p => p.label).join(", ") :
            profile.sampled ? "Aucune des orientations retenues dans les points échantillonnés." :
              "Aucun point échantillonné dans cette PRA."}</p>
          <p>Les orientations décrivent un contexte historique. Les effectifs et les localisations d’élevages restent inconnus.</p>
        </>}
    </section>
  );
}
