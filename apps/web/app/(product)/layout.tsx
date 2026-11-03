import { Suspense } from 'react';
import { UnifiedWorkspace } from '../../features/unified/workspace';
export default function ProductLayout({children}:{children:React.ReactNode}) {
  return <><Suspense fallback={<main>Chargement d’AgriclimaX…</main>}><UnifiedWorkspace /></Suspense>{children}</>;
}
