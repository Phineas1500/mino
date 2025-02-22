import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Store in your database or state management system
    // For now, we'll just return it
    return NextResponse.json({
      success: true,
      data: data
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process transcript' },
      { status: 500 }
    );
  }
}
