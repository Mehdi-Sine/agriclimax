import { redirect } from 'next/navigation';
import LegacyTerritories from './legacy';
export default async function Territories({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  if(params.pilot||params.reference||params.dataset)return <LegacyTerritories searchParams={Promise.resolve(params)} />;
  const query=new URLSearchParams();
  for(const key of ['pra','date'])if(typeof params[key]==='string')query.set(key,params[key]);
  redirect(`/?${query}`);
}
