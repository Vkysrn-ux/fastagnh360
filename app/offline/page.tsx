export const dynamic = 'force-static'

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="mt-3 text-muted-foreground">
        The app is installed and works offline for previously visited pages.
        Please reconnect to access fresh data or unvisited routes.
      </p>
    </div>
  )
}

