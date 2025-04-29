// videoCompressor.ts

const SIZE_THRESHOLD = 100 * 1024 * 1024; // Only compress videos larger than 100MB
const VERY_LARGE_THRESHOLD = 500 * 1024 * 1024; // More aggressive compression above 500MB

// Optimized compression presets for lecture videos
const COMPRESSION_PRESETS = {
  standard: {
    videoBitsPerSecond: 1500000,  // 1.5 Mbps
    quality: 0.80, // Note: Quality param isn't directly used by MediaRecorder bitrate mode
    maxWidth: 1280,
    maxHeight: 720
  },
  high_compression: {
    videoBitsPerSecond: 1000000,  // 1 Mbps
    quality: 0.70,
    maxWidth: 1024, 
    maxHeight: 576
  },
  extreme_compression: {
    videoBitsPerSecond: 800000,   // 800 Kbps
    quality: 0.60,
    maxWidth: 854,
    maxHeight: 480
  }
};

interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  // targetSize: number; // Not directly used in this method
  // quality: number; // Not directly used in this method
  videoBitsPerSecond: number;
}

// --- Add progress callback type ---
type ProgressCallback = (progress: number) => void;

export async function shouldCompress(file: File): Promise<boolean> {
  // Don't compress if file is smaller than threshold
  if (file.size < SIZE_THRESHOLD) {
    console.log('Skipping compression: File size below threshold.');
    return false;
  }

  // Check if it's already an MP4 and potentially within reasonable dimensions
  // Note: getVideoDimensions can be slow on mobile itself
  // if (file.type === 'video/mp4') {
  //   try {
  //     const dimensions = await getVideoDimensions(file);
  //     const needsResize = dimensions.width > 1280 || dimensions.height > 720;
  //     console.log(`MP4 dimensions: ${dimensions.width}x${dimensions.height}. Needs resize: ${needsResize}`);
  //     return needsResize; // Only compress if resize is needed
  //   } catch (dimError) {
  //      console.warn("Could not get video dimensions, proceeding with compression check based on size.", dimError);
  //      return true; // Compress if dimensions couldn't be checked
  //   }
  // }
  
  // For simplicity, compress if over size threshold and not MP4, or just over size threshold
  console.log('Needs compression: File size above threshold.');
  return true; // Compress any file over the size threshold for now
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
  onProgress?: ProgressCallback, 
  options: Partial<CompressionOptions> = {}
): Promise<Blob> {
  
  // --- Check moved to FileUpload.tsx is recommended, but keep here as fallback ---
  // const needsCompression = await shouldCompress(file);
  // if (!needsCompression) {
  //   console.log("compressVideo: Compression not needed based on shouldCompress.");
  //   return file; // Return original file if no compression needed
  // }
  // --- End of check ---

  console.log("Starting compression process for:", file.name);
  
  // Determine compression settings based on file size
  const isVeryLarge = file.size > VERY_LARGE_THRESHOLD;
  
  let compressionPreset = COMPRESSION_PRESETS.standard;
  if (isVeryLarge) {
    compressionPreset = COMPRESSION_PRESETS.extreme_compression;
    console.log("Using extreme compression preset.");
  } else if (file.size > SIZE_THRESHOLD) { // Check > SIZE_THRESHOLD here
    compressionPreset = COMPRESSION_PRESETS.high_compression;
    console.log("Using high compression preset.");
  } else {
     console.log("Using standard compression preset (or file is below threshold).");
  }


  const defaultOptions: CompressionOptions = {
    maxWidth: compressionPreset.maxWidth, // Use preset values
    maxHeight: compressionPreset.maxHeight,
    videoBitsPerSecond: compressionPreset.videoBitsPerSecond
  };

  const finalOptions = { ...defaultOptions, ...options };
  console.log("Final compression options:", finalOptions);

  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let mediaRecorder: MediaRecorder | null = null; 
    let rafId: number | null = null; 
    let progressInterval: NodeJS.Timeout | null = null; 
    let safetyTimeout: NodeJS.Timeout | null = null; // Define safetyTimeout here

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const videoUrl = URL.createObjectURL(file);
    video.muted = true; 
    video.preload = 'auto'; 
    video.src = videoUrl;

    const cleanup = () => {
        console.log("Cleaning up video compression resources.");
        if (rafId) cancelAnimationFrame(rafId);
        if (progressInterval) clearInterval(progressInterval);
        video.pause();
        video.removeAttribute('src'); // Release src
        video.load(); // Abort loading/playback
        URL.revokeObjectURL(videoUrl);
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try { mediaRecorder.stop(); } catch (e) { console.warn("Error stopping media recorder during cleanup:", e); }
        }
        if (safetyTimeout) clearTimeout(safetyTimeout); // Clear safety timeout during cleanup
    };

    video.addEventListener('loadedmetadata', () => {
      console.log("Video metadata loaded:", video.videoWidth, "x", video.videoHeight, "Duration:", video.duration);
      if (!video.duration || video.duration === Infinity) {
          cleanup();
          reject(new Error('Video duration is invalid or infinite. Cannot compress.'));
          return;
      }
      
      let { width, height } = calculateDimensions(
        video.videoWidth,
        video.videoHeight,
        finalOptions.maxWidth,
        finalOptions.maxHeight
      );
      
      canvas.width = width;
      canvas.height = height;
      console.log("Canvas dimensions set:", width, "x", height);
      
      video.play().then(() => { 
          console.log("Video playback started for compression.");

          // --- FIX 1: Define stream *before* using it ---
          const stream = canvas.captureStream(30); // Capture at 30fps
          if (!stream) { // Add check in case captureStream fails
              cleanup();
              reject(new Error("Failed to capture canvas stream."));
              return;
          }
          // --- End FIX 1 ---

          // --- Determine MimeType ---
          let mimeType = 'video/webm;codecs=vp8'; 
          if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
              mimeType = 'video/mp4;codecs=avc1';
          } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
              mimeType = 'video/webm;codecs=h264';
          } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
              mimeType = 'video/webm;codecs=vp9';
          }
          console.log("Using MediaRecorder mimeType:", mimeType);
          // --- End MimeType ---

          try {
              mediaRecorder = new MediaRecorder(stream, { // Now stream is defined
                mimeType: mimeType,
                videoBitsPerSecond: finalOptions.videoBitsPerSecond
              });
          } catch (recorderError) {
              console.error("Failed to create MediaRecorder:", recorderError);
              cleanup();
              // --- FIX 2: Check error type ---
              let message = 'Failed to initialize video recorder.';
              if (recorderError instanceof Error) {
                  message += ` ${recorderError.message}.`;
              }
              message += ` MimeType: ${mimeType}`;
              reject(new Error(message));
              // --- End FIX 2 ---
              return;
          }
          
          const chunks: Blob[] = [];
          mediaRecorder.addEventListener('dataavailable', (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          });
          
          mediaRecorder.addEventListener('stop', () => {
            console.log("MediaRecorder stopped.");
            cleanup(); // Perform cleanup
            if (chunks.length === 0) {
                console.error("Compression finished but no data chunks were recorded.");
                reject(new Error("Compression failed: No video data recorded."));
                return;
            }
            // Determine final blob type based on mimeType used
            const finalBlobType = mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
            const blob = new Blob(chunks, { type: finalBlobType });
            console.log("Compression successful. Blob size:", formatBytes(blob.size), "Type:", finalBlobType);
            resolve(blob);
          });

          // --- Add error handling for MediaRecorder ---
          mediaRecorder.addEventListener('error', (event) => {
              console.error("MediaRecorder error:", event);
              cleanup();
              reject(new Error(`MediaRecorder error: ${event.error.message || 'Unknown recorder error'}`));
          });
          // --- End error handling ---
          
          mediaRecorder.start();
          console.log("MediaRecorder started.");

          // --- FIX 3: Move safety timeout clearing inside the .then block ---
          // Clear timeout if recorder stops successfully
          mediaRecorder.addEventListener('stop', () => {
              if (safetyTimeout) clearTimeout(safetyTimeout);
          });
          // --- End FIX 3 ---
          
          let frameCount = 0;

          // --- Progress reporting ---
          if (onProgress) {
              progressInterval = setInterval(() => {
                  if (video.duration) {
                      const progress = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
                      onProgress(progress);
                  }
              }, 500); // Report progress every 500ms
          }
          // --- End progress reporting ---

          const drawFrame = () => {
            // Check if recorder is still active and video is playing
            if (!mediaRecorder || mediaRecorder.state !== 'recording' || video.paused || video.ended) {
              // If video ended naturally or paused unexpectedly, try to stop recorder
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                  console.log("Video ended or paused, stopping recorder.");
                  mediaRecorder.stop(); 
              } else if (mediaRecorder && mediaRecorder.state === 'inactive' && chunks.length === 0) {
                  // Handle case where recorder stopped prematurely without data
                  cleanup();
                  reject(new Error("Compression stopped prematurely without data."));
              }
              return; // Stop the loop
            }
            
            // Only draw every other frame for very large files to save resources
            if (!isVeryLarge || frameCount % 2 === 0) {
              ctx.drawImage(video, 0, 0, width, height);
            }
            frameCount++;
            rafId = requestAnimationFrame(drawFrame); // Continue the loop
          };
          
          rafId = requestAnimationFrame(drawFrame); // Start the loop

      }).catch(playError => {
          console.error("Failed to play video for compression:", playError);
          cleanup();
          reject(new Error(`Could not start video playback for compression: ${playError.message}`));
      });
    });
    
    video.addEventListener('error', (e) => {
      cleanup();
      // Try to get more specific error
      const error = video.error;
      let message = 'Error loading video for compression';
      if (error) {
          message += `: Code ${error.code}, Message: ${error.message}`;
      }
      console.error(message, e);
      reject(new Error(message));
    });

    // Add a timeout safeguard in case everything hangs
    safetyTimeout = setTimeout(() => { // Assign to safetyTimeout
        console.warn("Compression safety timeout reached. Aborting.");
        cleanup();
        reject(new Error("Compression timed out. The video might be too large or complex for the browser."));
    }, 5 * 60 * 1000); // 5 minutes timeout (adjust as needed)

    // --- Removed the addEventListener here, moved into .then() block ---

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