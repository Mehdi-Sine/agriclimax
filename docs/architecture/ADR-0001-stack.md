# ADR-0001 — Stack initiale
Status: accepted

## Décision
Next.js + TypeScript, MapLibre GL JS, Supabase/Postgres/PostGIS, Python, GitHub Actions, Vercel.

## Raisons
Faible coût d'entrée, composants open source majeurs, séparation claire calcul/UI, PostGIS natif, déploiement simple, trajectoire vers tuiles/COG sans microservices immédiats.

## Conséquence
Tout ajout d'infrastructure doit être justifié par une métrique ou une limitation observée.
