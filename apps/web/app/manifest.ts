import type { MetadataRoute } from "next";
import { BRAND } from "../lib/brand";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.descriptor,
    start_url: "/",
    display: "standalone",
    lang: "fr",
    icons: [
      {
        src: "/brand/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
