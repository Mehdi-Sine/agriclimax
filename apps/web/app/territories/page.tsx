import LegacyTerritories from './legacy';
import { NationalWorkspace } from '../../features/national/workspace';
export default async function Territories({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (
    process.env.PRA_NATIONAL_ENABLED !== '1' ||
    params.pilot ||
    params.reference ||
    params.dataset
  )
    return <LegacyTerritories searchParams={Promise.resolve(params)} />;
  return (
    <NationalWorkspace
      initialDate={typeof params.date === 'string' ? params.date : undefined}
      initialPra={typeof params.pra === 'string' ? params.pra : undefined}
    />
  );
}
