import { NextResponse } from 'next/server';

// The actual URL of your backend server's chat API
// It's good practice to use an environment variable for this, 
// but for clarity with your existing setup, I'll hardcode it here as you indicated.
// You might later move this to process.env.BACKEND_CHAT_API_URL
const PI_SERVER = process.env.PI_SERVER || 'http://100.70.34.122:3001';
const ACTUAL_BACKEND_CHAT_API_URL = `${PI_SERVER}/api/chat`;

export async function POST(request: Request) {
  try {
    const body = await request.json(); // Expects { message, jobId } from the frontend

    // Validate if message and jobId are present if needed, though your backend already does this.
    // const { message, jobId } = body;
    // if (!message || !jobId) {
    //   return NextResponse.json({ message: 'Message and jobId are required in chat proxy.' }, { status: 400 });
    // }

    console.log(`[Next API Proxy /api/chat-proxy] Forwarding request to: ${ACTUAL_BACKEND_CHAT_API_URL}`);
    console.log(`[Next API Proxy /api/chat-proxy] Body:`, body);

    const backendResponse = await fetch(ACTUAL_BACKEND_CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any other headers your backend might expect, if any.
      },
      body: JSON.stringify(body), // Forward the exact body received from the frontend
    });

    const responseData = await backendResponse.json().catch(err => {
      console.error("[Next API Proxy /api/chat-proxy] Error parsing JSON from backend:", err);
      // If backend response is not JSON or empty, but still !ok, create a generic error
      if (!backendResponse.ok) {
        return { message: `Backend responded with status ${backendResponse.status}` };
      }
      return {}; // Or handle as appropriate if backend might send non-JSON success
    });

    console.log(`[Next API Proxy /api/chat-proxy] Received status ${backendResponse.status} from backend.`);

    if (!backendResponse.ok) {
      console.error(`[Next API Proxy /api/chat-proxy] Error from backend: Status ${backendResponse.status}`, responseData);
      return NextResponse.json(
        { 
          message: responseData.message || 'Error from backend service while processing chat.',
          details: responseData 
        },
        { status: backendResponse.status || 500 }
      );
    }
    
    // Assuming your backend sends back { reply: "..." } on success
    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('[Next API Proxy /api/chat-proxy] Internal error:', error);
    return NextResponse.json(
      { message: 'Internal error in chat proxy.', error: (error as Error).message },
      { status: 500 }
    );
  }
} 