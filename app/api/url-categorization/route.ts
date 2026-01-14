
import { NextRequest, NextResponse } from 'next/server'
import { categorizeUrl } from '@lib/categorization'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url } = body
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 })
    }

    const category = categorizeUrl(url)
    return NextResponse.json({ url, category })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
