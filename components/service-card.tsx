import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, CreditCard, RefreshCw, ShieldAlert, Truck, AlertCircle } from "lucide-react"

interface ServiceCardProps {
  title: string
  description: string
  icon: string
  link: string
  color?: "primary" | "secondary" | "accent"
}

export function ServiceCard({ title, description, icon, link, color = "primary" }: ServiceCardProps) {
  const getIcon = () => {
    switch (icon) {
      case "CreditCard":
        return <CreditCard className="h-5 w-5 text-white" />
      case "RefreshCw":
        return <RefreshCw className="h-5 w-5 text-white" />
      case "ShieldAlert":
        return <ShieldAlert className="h-5 w-5 text-white" />
      case "Truck":
        return <Truck className="h-5 w-5 text-white" />
      default:
        return <AlertCircle className="h-5 w-5 text-white" />
    }
  }

  const getBackground = () => {
    switch (color) {
      case "primary":
        return "bg-blue-100"
      case "secondary":
        return "bg-blue-100"
      case "accent":
        return "bg-blue-100"
      default:
        return "bg-blue-100"
    }
  }

  const getIconColor = () => {
    switch (color) {
      case "primary":
        return "bg-primary text-white"
      case "secondary":
        return "bg-secondary text-white"
      case "accent":
        return "bg-accent text-white"
      default:
        return "bg-primary text-white"
    }
  }

  const getShadow = () => {
    switch (color) {
      case "primary":
        return "shadow-primary hover:shadow-primary/20"
      case "secondary":
        return "shadow-secondary hover:shadow-secondary/20"
      case "accent":
        return "shadow-accent hover:shadow-accent/20"
      default:
        return "shadow-primary hover:shadow-primary/20"
    }
  }

  const getBorderHover = () => {
    switch (color) {
      case "primary":
        return "border-primary/20 hover:border-primary/40"
      case "secondary":
        return "border-secondary/20 hover:border-secondary/40"
      case "accent":
        return "border-accent/20 hover:border-accent/40"
      default:
        return "border-primary/20 hover:border-primary/40"
    }
  }

  return (
    <Card className="gradient-card border-none shadow-md hover:shadow-lg transition-all">
      <CardHeader>
        <div className={`w-12 h-12 rounded-full ${getBackground()} flex items-center justify-center mb-2`}>
          <div className={`w-8 h-8 rounded-full ${getIconColor()} flex items-center justify-center`}>{getIcon()}</div>
        </div>
        <CardTitle className="font-poppins text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardContent>
      <CardFooter>
        <Link href={link} className="w-full">
          <Button variant="outline" className={`w-full group border-2 ${getBorderHover()}`}>
            Learn More
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
