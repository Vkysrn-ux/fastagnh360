import { NextRequest, NextResponse } from 'next/server'
import { getAgentStats } from '@/lib/actions/agent-actions'

export async function GET(_req: NextRequest) {
  try {
    const stats = await getAgentStats()
    return NextResponse.json(stats)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load stats' }, { status: 500 })
  }
}

