// videoCompressor.ts

const SIZE_THRESHOLD = 100 * 1024 * 1024; // Only compress videos larger than 100MB
const VERY_LARGE_THRESHOLD = 500 * 1024 * 1024; // More aggressive compression above 500MB

// Compression presets based on file size
const COMPRESSION_PRESETS = {
  standard: {
    videoBitsPerSecond: 2500000,  // 2.5 Mbps
    quality: 0.85
  },
  high_compression: {
    videoBitsPerSecond: 1500000,  // 1.5 Mbps
    quality: 0.75
  },
  extreme_compression: {
    videoBitsPerSecond: 1000000,  // 1 Mbps
    quality: 0.65
  }
};

interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  targetSize: number;
  quality: number;
  videoBitsPerSecond: number;
}

export async function shouldCompress(file: File): Promise<boolean> {
  // Don't compress if file is smaller than threshold
  if (file.size < SIZE_THRESHOLD) {
    return false;
  }

  // Check if it's already an MP4 and under maxWidth/maxHeight
  if (file.type === 'video/mp4') {
    const dimensions = await getVideoDimensions(file);
    return dimensions.width > 1280 || dimensions.height > 720;
  }

  return true;
}

async function getVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    
    video.src = url;
  });
}

export async function compressVideo(
  file: File, 
  options: Partial<CompressionOptions> = {}
): Promise<Blob> {
  // If file doesn't need compression, return it as is
  const needsCompression = await shouldCompress(file);
  if (!needsCompression) {
    return file;
  }

  // Determine compression settings based on file size
  const isVeryLarge = file.size > VERY_LARGE_THRESHOLD;
  
  // Select compression preset based on file size
  let compressionPreset = COMPRESSION_PRESETS.standard;
  if (file.size > VERY_LARGE_THRESHOLD) {
    compressionPreset = COMPRESSION_PRESETS.extreme_compression;
  } else if (file.size > SIZE_THRESHOLD) {
    compressionPreset = COMPRESSION_PRESETS.high_compression;
  }

  const defaultOptions: CompressionOptions = {
    maxWidth: 1280,
    maxHeight: 720,
    targetSize: 1080,
    quality: compressionPreset.quality,
    videoBitsPerSecond: compressionPreset.videoBitsPerSecond
  };

  const finalOptions = { ...defaultOptions, ...options };

  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;

    // Use requestVideoFrameCallback if available for better performance
    const useRAF = !('requestVideoFrameCallback' in video);
    
    video.addEventListener('loadedmetadata', () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = calculateDimensions(
        video.videoWidth,
        video.videoHeight,
        finalOptions.maxWidth,
        finalOptions.maxHeight
      );
      
      canvas.width = width;
      canvas.height = height;
      
      video.addEventListener('canplay', () => {
        const stream = canvas.captureStream();
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=h264',
          videoBitsPerSecond: finalOptions.videoBitsPerSecond
        });
        
        const chunks: Blob[] = [];
        mediaRecorder.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        });
        
        mediaRecorder.addEventListener('stop', () => {
          URL.revokeObjectURL(videoUrl);
          const blob = new Blob(chunks, { type: 'video/mp4' });
          resolve(blob);
        });
        
        mediaRecorder.start();
        
        // Use optimal frame drawing method
        let frameCount = 0;

        // Define the frame drawing function with proper typing
        const drawFrame = (timestamp: number) => {
          if (video.ended || video.paused) {
            mediaRecorder.stop();
            return;
          }
          
          // Only draw every other frame for very large files
          if (!isVeryLarge || frameCount % 2 === 0) {
            ctx.drawImage(video, 0, 0, width, height);
          }
          frameCount++;
          requestAnimationFrame(drawFrame);
        };
        
        video.play();
        requestAnimationFrame(drawFrame);
      });
    });
    
    video.addEventListener('error', (e) => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Error loading video: ' + e.message));
    });
  });
}

function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = width / height;
  
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.floor(width), height: Math.floor(height) };
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}