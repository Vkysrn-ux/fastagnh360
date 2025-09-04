import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Star } from "lucide-react"

interface TestimonialCardProps {
  name: string
  location: string
  quote: string
  rating: number
  color?: "primary" | "secondary" | "accent"
}

export function TestimonialCard({ name, location, quote, rating, color = "primary" }: TestimonialCardProps) {
  const getStarColor = () => {
    switch (color) {
      case "primary":
        return "text-blue-600 fill-blue-600"
      case "secondary":
        return "text-blue-500 fill-blue-500"
      case "accent":
        return "text-blue-400 fill-blue-400"
      default:
        return "text-blue-600 fill-blue-600"
    }
  }

  const getAvatarBg = () => {
    switch (color) {
      case "primary":
        return "bg-blue-100 text-primary"
      case "secondary":
        return "bg-blue-100 text-secondary"
      case "accent":
        return "bg-blue-100 text-accent"
      default:
        return "bg-blue-100 text-primary"
    }
  }

  return (
    <Card className="gradient-card border-none shadow-md hover:shadow-lg transition-all">
      <CardContent className="pt-6">
        <div className="flex mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-5 w-5 ${i < rating ? getStarColor() : "text-gray-300"}`} />
          ))}
        </div>
        <blockquote className="text-lg italic mb-4">"{quote}"</blockquote>
      </CardContent>
      <CardFooter className="border-t pt-4 flex justify-between">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{location}</p>
        </div>
        <div className={`h-10 w-10 rounded-full ${getAvatarBg()} flex items-center justify-center`}>
          <span className="font-medium text-sm">{name.charAt(0)}</span>
        </div>
      </CardFooter>
    </Card>
  )
}
