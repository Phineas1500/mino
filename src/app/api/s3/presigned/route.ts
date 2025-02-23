// src/app/api/s3/presigned/route.ts
import { NextRequest, NextResponse } from 'next/server'

const PI_SERVER = process.env.PI_SERVER || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileName, fileType } = body

    // Forward request to Pi server
    const response = await fetch(`${PI_SERVER}/s3/presigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName, fileType })
    })

    if (!response.ok) {
      throw new Error('Failed to get presigned URL from Pi')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error getting presigned URL:', error)
    return NextResponse.json(
      { error: 'Failed to get upload URL' },
      { status: 500 }
    )
  }
}