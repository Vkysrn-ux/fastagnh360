"use client"

import Script from "next/script"

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-WJ031B5RCT"

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}

          // Google Consent Mode v2 defaults (CPM/CMP ready)
          gtag('consent', 'default', {
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied',
            'analytics_storage': 'granted',
            'wait_for_update': 500
          });

          // Helper to update consent from a CMP if present
          window.__updateConsent = (prefs = { analytics: true, ads: false }) => {
            gtag('consent', 'update', {
              'analytics_storage': prefs.analytics ? 'granted' : 'denied',
              'ad_storage': prefs.ads ? 'granted' : 'denied',
              'ad_user_data': prefs.ads ? 'granted' : 'denied',
              'ad_personalization': prefs.ads ? 'granted' : 'denied'
            });
          };

          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  )
}

