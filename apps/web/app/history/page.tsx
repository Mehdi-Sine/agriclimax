import { LiveWorkspace } from '../../features/live/workspace';
export default async function HistoryPage({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = new URLSearchParams();
  for (const [key,value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.append(key,value);
    else if (Array.isArray(value)) for (const item of value) params.append(key,item);
  }
  return await LiveWorkspace({params, view:'history'});
}
