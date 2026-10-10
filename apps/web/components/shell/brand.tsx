import Link from "next/link";
import { BRAND } from "../../lib/brand";
export function BrandSymbol() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M5 33h38M6 27l10-5 8 7 11-15 7 5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="35" cy="14" r="4" fill="currentColor" />
    </svg>
  );
}
export function BrandLockup() {
  return (
    <Link href="/" className="brand" aria-label={`${BRAND.name} — accueil`}>
      <BrandSymbol />
      <span>
        <strong>{BRAND.name}</strong>
        <small>{BRAND.signature}</small>
      </span>
    </Link>
  );
}
