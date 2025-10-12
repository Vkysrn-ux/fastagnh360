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
      // Use the square app logo (1200x1200). Browsers will downscale as needed.
      {
        src: '/logo.png',
        sizes: '1200x1200',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
