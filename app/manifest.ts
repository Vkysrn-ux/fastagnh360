import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NH360fastag.com',
    short_name: 'NH360',
    description:
      'Register for FASTag for all vehicles, all bank FASTag available, nationwide delivery, recharge services, and blacklist resolution.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b5cc2',
    icons: [
      {
        src: '/placeholder-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/placeholder-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

