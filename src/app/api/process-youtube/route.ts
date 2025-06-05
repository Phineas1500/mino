import { NextResponse } from 'next/server';

const PI_SERVER = process.env.PI_SERVER || 'http://100.70.34.122:3001'

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json({ error: 'youtubeUrl is required' }, { status: 400 });
    }

    // Basic URL validation (optional, backend should also validate)
    if (!youtubeUrl.startsWith('http://') && !youtubeUrl.startsWith('https://')) {
       return NextResponse.json({ error: 'Invalid YouTube URL format' }, { status: 400 });
    }

    const backendUrl = `${PI_SERVER}/process/youtube-url`; // Your NEW backend endpoint
    console.log(`Forwarding YouTube URL request to backend: ${backendUrl}`);

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ youtubeUrl }),
      // Consider a timeout for this initial request if needed
    });

    // Handle backend response (expecting 202 Accepted or 409 Conflict)
    if (backendResponse.status === 202) {
      const result = await backendResponse.json();
      console.log(`Backend accepted YouTube job: ${result.jobId}`);
      return NextResponse.json({ jobId: result.jobId }, { status: 202 });
    } else if (backendResponse.status === 409) {
      const result = await backendResponse.json();
      console.warn(`Backend reported conflict (409) for YouTube URL: ${result.error}`);
      return NextResponse.json({ error: result.error || 'Processing already in progress' }, { status: 409 });
    } else {
      // Handle other errors from the backend during initiation
      const errorText = await backendResponse.text();
      console.error(`Backend YouTube processing initiation failed with status ${backendResponse.status}: ${errorText}`);
      return NextResponse.json({ error: `Backend failed to process YouTube URL: ${errorText}` }, { status: backendResponse.status });
    }

  } catch (error) {
    console.error('Error in /api/process-youtube:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process YouTube URL';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}