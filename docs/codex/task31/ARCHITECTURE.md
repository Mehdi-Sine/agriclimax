# Fondation du Journal agroclimatique

Branche `codex/31-agroclimatic-journal-foundation`, créée depuis `origin/main` 50eac24 (inclut Task30 et la fiabilisation quotidienne déjà livrée dans une autre Task31).

## Flux et responsabilités

Archives vérifiées existantes → `nationalWeatherDocument` → `nationalWatch` (Task30, calculateurs existants) → `features/journal/model.ts` (fonction pure avec horloge explicite) → validation AJV et références → cache borné serveur → `/api/journal` et Server Component `/journal`.

Le journal ne charge ni géométrie, ni nouvelles observations, ni réanalyses brutes, ni API externe de rédaction. Les cartes sont des références profondes vers `/veille`, avec cycle exact, phénomène et région. La page de veille dispose d'un lien Journal ; la home et les workflows sont conservés.

`registry.ts` isole les contributeurs de production. `history.ts` isole le comparateur scientifique, qui accepte des snapshots homogènes explicitement documentés. `validate.ts` contrôle le DTO complet et les références factuelles. Aucun appel Supabase direct ajouté : le lecteur Task30 assure authentification serveur, bornes de téléchargement, SHA-256 et contrats météo.

## Ressources et cache

Trois éditions au maximum par instance, après le cache national existant. Pas de copie des métriques individuelles des 713 PRA dans le DTO. Des événements régionaux et preuves dédupliquées logiquement par identifiant sont transportés ; certaines références d'événements sont matérialisées dans les rubriques pour simplifier la lecture. Le JSON reste de l'ordre de 0,1–0,2 Mo, sans géométrie.

Le manifeste existant conserve sa revalidation 60 s. L'ETag combine identité d'édition et classe de fraîcheur. `private, no-cache` impose la revalidation. Les erreurs ne sont pas conservées. Les dates de fraîcheur sont réévaluées à la consultation, même si la génération est réutilisée. La page est dynamique côté serveur, sans hydratation métier supplémentaire ; recharger pour relire le manifeste.

## Persistance ultérieure

Aucune migration et aucune écriture d'archives. Une tâche ultérieure pourra écrire un objet immuable par `edition_id`, indexer date et révision, conserver l'édition remplacée et enregistrer séparément l'heure de publication. La fonction de génération peut être appelée après validation nationale depuis un workflow futur. `generated_at` reste hors identité factuelle. Toute modification des règles, adaptateurs ou contrats impose de changer leurs versions.

## Limites assumées

La sortie réelle de cette fondation exploite les prévisions. Le comparateur est réutilisable et testé pour observations/réanalyses, mais le branchement d'une série historique de snapshots éditoriaux qualifiés reste à développer ; les archives ne sont pas assimilées à une telle série. Aucun épisode persistant n'est annoncé à partir de deux fenêtres J+1/J+7 décalées. La lecture des anomalies existantes reste accessible par `/veille?periode=history`.
