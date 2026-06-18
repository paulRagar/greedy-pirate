import type { MetadataRoute } from 'next';

const SITE = 'https://greedypirate.com';

export default function sitemap(): MetadataRoute.Sitemap {
   const lastModified = new Date('2026-06-17');
   return [
      { url: `${SITE}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
      { url: `${SITE}/rules`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
      { url: `${SITE}/choose-game`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
      { url: `${SITE}/play-local`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
      { url: `${SITE}/play/join`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
   ];
}
