import { NextRequest, NextResponse } from 'next/server'
import { runAiInsights } from '@/lib/ai/generators'

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  
  if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })
  }
  
  try {
      await runAiInsights(orgId, 'daily')
      return NextResponse.json({ success: true })
  } catch (error: any) {
      console.error('AI Daily Run Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
