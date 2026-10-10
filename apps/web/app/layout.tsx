import type { Metadata } from "next";
import { BRAND } from "../lib/brand";
import "../styles/tokens.css";
import "../styles/globals.css";
export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.descriptor,
  applicationName: BRAND.name,
  icons: { icon: "/brand/favicon.svg", apple: "/brand/app-icon.svg" },
};
const themeInit = `(function(){try{var t=localStorage.getItem('agriclimax-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}})()`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
