import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "イケオジの深夜Bar",
    short_name: "深夜Bar",
    description:
      "愚痴を聞いてくれる渋いイケオジ。親父ギャグと全肯定で夜を深める音声バー。",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0705",
    theme_color: "#0a0705",
    lang: "ja",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
