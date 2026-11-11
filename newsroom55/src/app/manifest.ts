import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Télécommande — Centre de nouvelles",
    short_name: "Télécommande",
    description: "Télécommande multivue du Cisco Board 55",
    start_url: "/remote",
    scope: "/",
    display: "standalone",
    background_color: "#050a10",
    theme_color: "#07111c",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
