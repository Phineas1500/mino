// src/lib/video-service.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

class VideoProcessor {
  private ffmpeg: FFmpeg | null = null;

  async init() {
    if (this.ffmpeg) return;
    
    this.ffmpeg = new FFmpeg();
    
    // Load FFmpeg
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
  }

  async processVideo(videoUrl: string) {
    if (!this.ffmpeg) await this.init();
    
    try {
      // Download the video from the URL
      const videoData = await fetchFile(videoUrl);
      
      // Write the input file
      await this.ffmpeg!.writeFile('input.mp4', videoData);
      
      // Extract audio for transcription
      await this.ffmpeg!.exec([
        '-i', 'input.mp4',
        '-vn', // No video
        '-acodec', 'pcm_s16le', // Raw audio format
        '-ar', '16000', // Sample rate
        '-ac', '1', // Mono
        'audio.wav'
      ]);

      // Read the audio file
      const audioData = await this.ffmpeg!.readFile('audio.wav');
      
      // Convert to Uint8Array if it's not already
      const audioArray = typeof audioData === 'string' 
        ? new TextEncoder().encode(audioData) 
        : audioData;
      
      // TODO: Send audio for transcription
      console.log('Audio extracted successfully', audioArray.byteLength);
      
      // For testing: Create a simple processed version
      await this.ffmpeg!.exec([
        '-i', 'input.mp4',
        '-vf', 'setpts=0.5*PTS', // Speed up video to 2x
        'output.mp4'
      ]);
      
      const processedVideo = await this.ffmpeg!.readFile('output.mp4');
      const videoArray = typeof processedVideo === 'string'
        ? new TextEncoder().encode(processedVideo)
        : processedVideo;
        
      console.log('Video processed successfully', videoArray.byteLength);
      
      // TODO: Upload processed video back to Blob storage
      return {
        success: true,
        message: 'Video processed successfully'
      };
    } catch (error) {
      console.error('Processing error:', error);
      throw error;
    }
  }
}

export const videoProcessor = new VideoProcessor();