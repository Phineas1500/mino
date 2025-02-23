// src/app/api/process-video/route.ts
import { NextRequest, NextResponse } from 'next/server'

const PI_SERVER = process.env.PI_SERVER || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileKey } = body

    console.log('Forwarding process request to Pi:', {
      server: PI_SERVER,
      fileKey
    })

    const response = await fetch(`${PI_SERVER}/process/s3-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileKey })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Processing error from Pi:', errorData)
      return NextResponse.json({ 
        success: false,
        error: `Failed to process video: ${errorData}`
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('Received data from processing server:', data)
    
    // Ensure we're returning the exact structure expected by the client
    return NextResponse.json({
      success: true,
      originalUrl: data.originalUrl || data.url, // Handle both possible property names
      shortenedUrl: data.shortenedUrl,
      data: {
        transcript: data.data?.transcript || '',
        segments: data.data?.segments || [],
        summary: data.data?.summary || '',
        keyPoints: data.data?.keyPoints || [],
        flashcards: data.data?.flashcards || []
      }
    })

  } catch (error) {
    console.error('Error in process-video route:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}