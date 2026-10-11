'use client';
import { DataState } from '../../components/ui/scientific';
import { Button } from '../../components/ui/primitives';
export default function WatchError({ reset }: { reset: () => void }) {
  return <main className="app-main"><h1>Veille climatique agricole</h1><DataState state="source-error" action={<Button onClick={reset}>Réessayer</Button>} /></main>;
}
