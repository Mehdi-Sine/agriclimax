import type { ComplementaryValue } from "./complement-model";
const number = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
export function ComplementNotice({ result }: { result: ComplementaryValue }) {
  return (
    <section
      className="coastal-complement"
      aria-label="Estimation historique complémentaire"
      data-native-coverage="0"
    >
      <p>
        <strong>Estimation complémentaire · reconstruction spatiale</strong>
      </p>
      <div className="unified-value">
        <strong>
          {number(result.value)} <em>{result.unit}</em>
        </strong>
      </div>
      <p>
        {result.days} journées reconstituées · couverture native de Crozon : 0
        %. Valeur exploratoire à partir des cellules terrestres voisines
        ERA5-Land. Les surfaces observées de la carte restent distinctes de
        cette estimation.
      </p>
      <p>
        Aucune normale, anomalie, température extrême, journée de chaleur ou de
        gel déduite de cette reconstruction.
      </p>
      <details>
        <summary>Méthode, validation et limites</summary>
        <p>
          Quatre voisins au plus, au moins trois dans un rayon de 25 km ;
          pondération par l’inverse du carré de distance, puis par les surfaces
          des cellules cibles.
        </p>
        <p>
          Validation avec toutes les cellules de chaque PRA témoin retirées :{" "}
          {result.validation.pra} PRA, {result.validation.pra_days} PRA-jours.
          Erreur absolue moyenne : {number(result.validation.mae)}{" "}
          {result.validation.unit} ; percentile 95 :{" "}
          {number(result.validation.p95_absolute_error)}{" "}
          {result.validation.unit}.
        </p>
        <p>
          La reconstruction extrapole vers le littoral depuis des cellules
          terrestres voisines. Ces erreurs portent sur le champ ERA5-Land des
          témoins. Elles ne sont ni un intervalle de confiance pour Crozon, ni
          une validation en station ou du microclimat de chaque parcelle. Pour
          un cumul, les erreurs quotidiennes ne constituent pas un intervalle
          d’incertitude du total.
        </p>
        <p>
          Méthode : {result.method_version} · source distincte :{" "}
          {result.source_id}. Couverture temporelle : 100 % sur la période
          choisie.
        </p>
      </details>
    </section>
  );
}
