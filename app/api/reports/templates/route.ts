import { NextRequest, NextResponse } from 'next/server'
import { reportTemplates } from '@lib/reports'

export async function GET(_req: NextRequest) {
  return NextResponse.json(reportTemplates())
}

