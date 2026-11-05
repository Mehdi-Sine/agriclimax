# Décision Task25

**EN VALIDATION — acquisition nationale RPG en cours.**

SAA nationale réellement intégrée : 2010–2025, 128 productions, 436 761 valeurs, cartes aux mailles départementales/régionales publiées. Le RPG publié correspond encore à six livraisons complètes, 4 256 355 parcelles, dont six corses. Les autres régions sont en acquisition reprenable. Aucun résultat partiel n'est présenté comme national.

La recette réelle locale et distante passe à 1440/768/390, avec le même canevas, les API DEV et les chiffres officiels. La Preview vérifiée est documentée dans `preview/browser-real.json`. Son navigateur est relié par une passerelle locale en lecture seule qui valide normalement TLS vers Vercel ; aucune donnée simulée, aucun contournement TLS, aucune modification du magasin de confiance personnel. La demande antérieure de modification NSS n'est plus nécessaire.

La conservation compacte sans perte des seules couches Parcelles utilisées résout la contrainte initiale de rétention des 10,95Go d'archives complètes : SHA256 du fichier original et du cache, vérification du contenu décompressé, éviction des seules copies redondantes après checkpoint. Le téléchargement utilise des plages bornées vérifiées avant assemblage, puis l'empreinte de l'éditeur avant extraction.

Restent à terminer : les lots RPG manquants, la répétition de l'audit interrégional sur la couverture finale, puis sa publication et sa recette. L’audit version2 sur les six lots a mesuré et exclu 0,089504388ha de recouvrements supplémentaires, avec bilans région×groupe conservés. Le volume global PostgreSQL n'est pas mesurable avec le seul accès REST ; ajout agricole en DB : zéro. La PR reste draft, sans merge ni production. La décision finale sera fondée sur la couverture et les contrôles effectivement terminés.
