import '../styles/tokens.css';
export const metadata = { title: 'AgriclimaX', description: 'L’observatoire des risques climatiques agricoles.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
