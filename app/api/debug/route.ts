import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    apiKeyLength: process.env.API_KEY?.length || 0,
    startsWith: process.env.API_KEY?.slice(0, 6),
    endsWith: process.env.API_KEY?.slice(-6),
  })
}
