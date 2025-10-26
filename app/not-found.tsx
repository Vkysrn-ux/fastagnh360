import Link from "next/link"

export default function NotFound() {
  return (
    <div className="container py-20 text-center">
      <h1 className="font-poppins text-4xl font-bold mb-4">Page Not Found</h1>
      <p className="text-muted-foreground mb-8">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <div className="flex gap-4 justify-center">
        <Link href="/" className="underline text-primary">Go to Home</Link>
        <span>•</span>
        <Link href="/login" className="underline">Login</Link>
      </div>
    </div>
  )
}

