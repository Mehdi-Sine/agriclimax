# Recette finale UX-03

[Preview Vercel](https://agriclimax-git-codex-ux-03-journal-6d87de-mehdi-sines-projects.vercel.app/)
· [PR draft #90](https://github.com/Mehdi-Sine/agriclimax/pull/90)

Base : **2f0b47b**, incluant #88 et #89. Application vérifiée : **849230f**.
Les ajouts suivants de documentation et de preuves ne changent pas l'application.

## Vingt cartes réelles, quarante ouvertures sur la Preview

Le test `tests/e2e/ux03.mjs` utilise les deux exports vérifiés d'EDIT-03. Pour
chaque édition, il contrôle les dix cartes dans l'ordre publié, puis ouvre
**chaque lien** sur desktop (1440 × 1000) et mobile tactile (390 × 844).
Les quarante payloads sont identiques aux archives gelées ; l'identifiant,
la période, le titre et les cinq classes de légende correspondent à la carte
interactive. Les dates des cartes, parfois antérieures à l'article, restent
explicites. Aucun dommage, anomalie ou classement éditorial nouveau n'est déduit.

| Édition | Cartes | Natures | Poids total des dix WebP | Poids unitaire |
|---|---:|---|---:|---:|
| 12 novembre | 10 | 5 historiques + 5 prévisions | 402 376 octets | 35 996 à 45 346 octets |
| 13 novembre | 10 | 5 historiques + 5 prévisions | 406 740 octets | 38 458 à 44 582 octets |

WebP sans perte, **480 × 300**, contours officiels simplifiés des 713 PRA,
dont les six corses. NULL gris, zéro classé et supports partiels hachurés.
Le Journal ne demande ni payload cartographique détaillé ni GeoJSON national
et ne crée aucun canvas WebGL. Les images sont demandées dès le HTML et mises
en cache ; les liens ne préchargent pas les pages interactives.

Le temps mesuré jusqu'au chargement des **dix** images, page incluse, est de
14,0 s / 7,0 s lors des premiers passages desktop, puis 1,77 s / 1,43 s sur les
passages mobiles suivants. Le premier accès dépend de la lecture des archives et
du rendu à froid : ce n'est pas une garantie de latence réseau. L'article, les
titres, légendes et liens restent visibles pendant le chargement ; les dimensions
des aperçus sont réservées. Le cache réduit les passages suivants.

[Rapport Preview détaillé](evidence/preview/report.json).

## Navigation, accès et robustesse

- Flèches desktop, touches ←/→ et Début/Fin, focus visible et accès aux dix liens.
- Swipe natif mobile vérifié avec des événements tactiles Chromium réels.
- `prefers-reduced-motion` respecté, aucun défilement automatique.
- Chargement retardé et dix miniatures en échec : titres, périodes, légendes et
  liens restent disponibles ; aucun écran vide.
- Date sans édition : état d'absence explicite, aucune substitution récente.
- Archives, avertissement expérimental et réserves scientifiques conservés.
- Zéro débordement horizontal de page, zéro erreur JavaScript, **zéro violation
  axe WCAG A/AA** sur les quatre Journal de recette.
- Contrôle UX-02B sur desktop/tablette/mobile, Journal et Cartes du jour :
  six pages, zéro violation, identité exacte (stripes 10 px, logo Georgia 36 px,
  bleu marine, fond et corail des tokens).
- Recette INT-01 isolée des données réelles non publiées : quatre largeurs
  (1440, 768, 390, 360), accès depuis les miniatures, PRA littorale sans valeur,
  sélection corse, changement d'indicateur, clic carte, absence et erreur transport.
  Les assertions de fond sont conservées ; seul le parcours d'entrée est adapté.

## Contrôles techniques

- **715 tests web réussis**, huit tests déjà désactivés dans le dépôt.
- 39 tests ciblés cartes/EDIT-03, puis 16 tests cartes après le dernier contrôle
  des identités géographiques : réussis. Vingt rendus réels testés, intégrité,
  zéro/NULL, partiel, cache, ETag/304, mauvais identifiant et erreur archive.
- ESLint sans avertissement ; TypeScript et build de production réussis.
- Assets `tokens.css` et `journal-pra-v1.geojson` présents dans la trace de la
  route Vercel. Première recette distante réussie sur les images générées.
- Gardes secrets source et client, contrats, migrations et exceptions d'audit :
  réussis. JS/CSS client gzip total : **693 899 octets / 2 097 152 autorisés**.
- Avertissement de build préexistant : accès filesystem dynamique dans
  `editorial-ai/archive.ts`. Aucun nouveau warning de lint.
- Périmètres protégés sans diff : Supabase, moteur, configuration, fixtures,
  workflows, scripts d'acquisition, sélection EDIT-03, registre/palettes,
  tokens scientifiques et publication des bundles.

Les [preuves et leur inventaire](evidence/verification.json) enregistrent le
commit applicatif, les contrôles et les empreintes des captures. Le classement
EDIT-03 est toujours en simulation. Aucun appel IA, écriture distante, acquisition,
modification de donnée ou publication éditoriale n'a été effectué.

## Captures de la Preview

| Édition | Desktop | Mobile | Cartes interactives |
|---|---|---|---|
| 12 novembre | [Journal](evidence/preview/2026-11-12-desktop-journal.png) · [Carrousel](evidence/preview/2026-11-12-desktop-carousel.png) | [Journal](evidence/preview/2026-11-12-mobile-journal.png) · [Carrousel](evidence/preview/2026-11-12-mobile-carousel.png) | [Desktop](evidence/preview/2026-11-12-desktop-interactive.png) · [Mobile](evidence/preview/2026-11-12-mobile-interactive.png) |
| 13 novembre | [Journal](evidence/preview/2026-11-13-desktop-journal.png) · [Carrousel](evidence/preview/2026-11-13-desktop-carousel.png) | [Journal](evidence/preview/2026-11-13-mobile-journal.png) · [Carrousel](evidence/preview/2026-11-13-mobile-carousel.png) | [Desktop](evidence/preview/2026-11-13-desktop-interactive.png) · [Mobile](evidence/preview/2026-11-13-mobile-interactive.png) |

[Tablette](evidence/identity/after-journal-tablet.png) ·
[Chargement desktop](evidence/preview/desktop-loading.png) ·
[Chargement mobile](evidence/preview/mobile-loading.png) ·
[Miniatures absentes desktop](evidence/preview/desktop-missing-thumbnails.png) ·
[Miniatures absentes mobile](evidence/preview/mobile-missing-thumbnails.png).

CI du commit applicatif **849230f** : [Quality #414](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43477069328)
et [Security audits #418](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43477069348)
**réussis**. Les cinq jobs Quality sont verts : gardes, Python/contrats, SQL
public/extensions et web/navigateur, y compris la recette INT-01 adaptée.
Le déploiement Vercel de ce commit est réussi.

PR conservée **draft**, sans fusion automatique. Aucun déploiement de production.
