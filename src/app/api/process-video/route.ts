// src/app/api/process-video/route.ts
import { NextRequest, NextResponse } from 'next/server'

const PI_SERVER = process.env.PI_SERVER || 'http://100.70.34.122:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileName, fileKey } = body

    console.log('Forwarding process request to Pi:', {
      server: PI_SERVER,
      fileKey
    })

    const response = await fetch(`${PI_SERVER}/process/s3-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName, fileKey })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Processing error from Pi:', errorText)
      throw new Error(`Failed to process video: ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in process-video route:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}