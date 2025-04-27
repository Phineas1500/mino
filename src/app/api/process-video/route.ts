// src/app/api/process-video/route.ts
import { NextRequest, NextResponse } from 'next/server'

const PI_SERVER = process.env.PI_SERVER || 'http://100.70.34.122:3001'

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileKey } = body;

    if (!fileKey) {
      return NextResponse.json({ error: 'fileKey is required' }, { status: 400 });
    }

    const backendUrl = `${process.env.PI_SERVER}/process/s3-video`; // Your backend endpoint
    console.log(`Forwarding process request to backend: ${backendUrl} for key: ${fileKey}`);

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // Ensure backend knows we expect JSON
      },
      body: JSON.stringify({ fileKey }),
      // Add a reasonable timeout if needed, but Vercel's limit is the main concern
    });

    // Check specific status codes from backend
    if (backendResponse.status === 202) {
      const result = await backendResponse.json();
      console.log(`Backend accepted job: ${result.jobId}`);
      // Forward the 202 status and jobId to the frontend
      return NextResponse.json({ jobId: result.jobId }, { status: 202 });
    } else if (backendResponse.status === 409) {
      const result = await backendResponse.json(); // Get the error message
      console.warn(`Backend reported conflict (409): ${result.error}`);
      // Forward the 409 status and error message to the frontend
      return NextResponse.json({ error: result.error || 'Processing already in progress' }, { status: 409 });
    } else {
      // Handle other unexpected errors from the backend
      const errorText = await backendResponse.text();
      console.error(`Backend returned error status ${backendResponse.status}: ${errorText}`);
      return NextResponse.json({ error: `Backend processing initiation failed: ${errorText}` }, { status: backendResponse.status });
    }

  } catch (error) {
    console.error('Error in /api/process-video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate processing';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}