import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: appConfig.siteUrl,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
