import type { MetadataRoute } from 'next';

const SITE = 'https://greedypirate.com';

export default function robots(): MetadataRoute.Robots {
   return {
      rules: [
         {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/admin/', '/auth/', '/play/', '/profile'],
         },
      ],
      sitemap: `${SITE}/sitemap.xml`,
      host: SITE,
   };
}
