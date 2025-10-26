"use client"

import { useEffect, useState } from "react"
import Script from "next/script"

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-WJ031B5RCT"

export function GoogleAnalytics() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|; )cookie-consent=([^;]*)/)
      const existing = match ? decodeURIComponent(match[1]) : null
      const update = (window as any).__updateConsent as
        | ((prefs: { analytics: boolean; ads: boolean }) => void)
        | undefined
      if (existing) {
        if (update) update({ analytics: existing === "accepted", ads: false })
      } else {
        setShowBanner(true)
      }
    } catch {
      // no-op
    }
  }, [])

  const setConsent = (accepted: boolean) => {
    const maxAge = 60 * 60 * 24 * 180
    document.cookie = `cookie-consent=${accepted ? "accepted" : "rejected"}; path=/; max-age=${maxAge}`
    try {
      const update = (window as any).__updateConsent as
        | ((prefs: { analytics: boolean; ads: boolean }) => void)
        | undefined
      if (update) update({ analytics: accepted, ads: false })
    } catch {}
    setShowBanner(false)
  }

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
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-5xl p-3">
          <div className="rounded-lg border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              We use cookies to enhance your experience and analyze traffic. You can accept analytics cookies or continue with only essential cookies.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setConsent(true)}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Accept
              </button>
              <button
                onClick={() => setConsent(false)}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
