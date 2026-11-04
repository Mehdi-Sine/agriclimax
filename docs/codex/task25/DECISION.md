# Décision Task25

**EN VALIDATION — autorisation locale attendue pour la recette navigateur Preview. Ne pas interpréter comme READY.**

Le sous-ensemble SAA est national et substantiel ; le RPG est réellement calculé mais sa couverture dépend des checkpoints terminés. La cible `READY_FOR_AGRICULTURAL_UX_REVIEW` exige encore le RPG national, le contrôle des recouvrements interrégionaux, une Preview réelle et les checks CI verts.

Sous-ensemble concret : SAA 2010–2025 nationale, 128 productions et 436 761 valeurs ; RPG2025 de trois livraisons complètes, 737 006 parcelles et 123 PRA, dont six corses. La rubrique Productions et le croisement blé fonctionnent sur les données réellement acquises. La recette locale réelle passe à 1440/768/390. Les API de la Preview répondent avec les mêmes valeurs et empreintes (`preview-http.json`).

Limites restantes : cache national RPG trop volumineux pour le disque du worker (10,95Go d'archives seules), recouvrements entre identifiants distincts de régions différentes non contrôlés, mesures globales de DB non disponibles via l'accès REST. Aucune source agricole n'est déclarée inaccessible ; les limites de couverture sont affichées.

Le navigateur Preview refuse le certificat du proxy du worker. Une autorisation explicite a été demandée pour ajouter ce certificat public, déjà approuvé par le système, au magasin NSS Chromium local. Aucun contournement TLS ni modification non autorisée du dossier personnel n'est effectué. La vérification visuelle distante n'est donc pas revendiquée. Les premières dépendances d'extraction ont été remplacées par les versions corrigées, avec relecture d'une archive officielle à empreinte identique ; la dernière CI doit confirmer ce correctif.

La décision finale sera mise à jour dans cette même branche après la réponse d'autorisation et les derniers contrôles. Une carte grise ou les seuls tests simulés ne constituent pas une validation. La PR reste draft, sans merge ni mise en production.
