import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript) {
      return NextResponse.json({ 
        success: false, 
        error: 'No transcript provided' 
      }, { status: 400 });
    }

    // Call Modal's process_transcript function
    const modalResponse = await fetch('http://localhost:3001/api/transcript/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript })
    });

    if (!modalResponse.ok) {
      throw new Error('Modal processing failed');
    }

    const result = await modalResponse.json();
    
    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error in test route:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process transcript'
    }, { status: 500 });
  }
} 