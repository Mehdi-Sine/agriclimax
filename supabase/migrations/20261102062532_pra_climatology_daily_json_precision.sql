begin;
-- Preserve binary real values through JSON even if the caller uses extra_float_digits=0.
-- This changes serialization only: stored normals and server subtraction are unchanged.
alter function public.agriclimax_pra_climatology_daily_read(text,text,text,date,date)
 set extra_float_digits=3;
notify pgrst,'reload schema';
commit;
