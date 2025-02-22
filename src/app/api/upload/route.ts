// src/app/api/upload/route.ts
import { NextResponse } from "next/server";
import { put } from '@vercel/blob';
import { videoProcessor } from '@/lib/video-service';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Upload to Blob storage
    const { url } = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true // Adds random suffix to prevent naming conflicts
    });

    // Start processing
    try {
      await videoProcessor.processVideo(url);
      
      return NextResponse.json({ 
        success: true,
        url,
        message: "Video uploaded and processing started"
      });
    } catch (processError) {
      console.error("Processing error:", processError);
      return NextResponse.json({ 
        success: true,
        url,
        message: "Video uploaded but processing failed",
        error: processError instanceof Error ? processError.message : "Unknown processing error"
      });
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}