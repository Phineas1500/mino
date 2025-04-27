// filepath: src/app/api/process-status/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId query parameter is required' }, { status: 400 });
    }

    const backendUrl = `${process.env.PI_SERVER}/process/status/${jobId}`; // Your backend status endpoint
    console.log(`Polling backend status: ${backendUrl}`);

    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add cache: 'no-store' to ensure fresh data on each poll
      cache: 'no-store', 
    });

    if (!backendResponse.ok) {
      // Handle cases where the backend returns an error (e.g., 404 Not Found, 500)
      const errorText = await backendResponse.text();
      console.error(`Backend status check failed for job ${jobId} with status ${backendResponse.status}: ${errorText}`);
      // Forward the backend's status and a generic error
      return NextResponse.json({ status: 'error', message: `Backend status check failed: ${errorText}` }, { status: backendResponse.status });
    }

    // If backend response is OK, parse the JSON and forward it
    const result = await backendResponse.json();
    console.log(`Received status for job ${jobId}:`, result.status);
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error in /api/process-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get processing status';
    return NextResponse.json({ status: 'error', message: errorMessage }, { status: 500 });
  }
}