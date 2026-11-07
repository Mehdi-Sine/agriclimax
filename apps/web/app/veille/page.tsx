import {Suspense} from 'react';
import {NationalWatchWorkspace} from '../../features/national-watch/workspace';
export default function Page(){return <Suspense fallback={<main>Chargement de la veille nationale…</main>}><NationalWatchWorkspace/></Suspense>;}
