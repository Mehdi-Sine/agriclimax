-- ABANDONNÉ / NON APPLICABLE SUR SUPABASE MANAGÉ — NE PAS EXÉCUTER.
-- Artefact historique uniquement. Migration retirée ; installation inchangée.
-- Voir CLOSURE.md.
-- PROPOSITION UNIQUEMENT : non appliquée. À enregistrer comme nouvelle migration
-- Correctif autorisé ; tentative versionnée rollbackée faute de droits propriétaire.
-- Voir PERMISSION_MIGRATION_STATUS.md et la migration 20261010175220.
-- forward-only après autorisation. Ne pas réécrire 0001–0004.
begin;
-- Lecture des références spatiales conservée ; aucune donnée supprimée/modifiée.
revoke insert, update, delete, truncate, references, trigger
  on table public.spatial_ref_sys from public, anon, authenticated;
-- AgriclimaX n'utilise pas ces fonctions d'estimation technique.
revoke execute on function
  public.st_estimatedextent(text,text),
  public.st_estimatedextent(text,text,text),
  public.st_estimatedextent(text,text,text,boolean)
  from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
