import { redirect } from 'next/navigation';
export default async function Climate({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const p=await searchParams;
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(p))if(typeof value==='string')query.set(key,value);
  if(p.mode==='demo')redirect(`/demo?${query}`);
  if(p.mode==='live_meteofrance'||p.mode==='wheat')redirect(`/stations?${query}`);
  if(p.view==='watch')redirect(`/watch?${query}`);
  return null;
}
