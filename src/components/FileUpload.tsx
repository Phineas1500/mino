'use client'

import { useState, useEffect } from "react"
import { Upload, Loader2 } from "lucide-react"
import { compressVideo, shouldCompress, formatBytes } from "./videoCompressor"

const PI_SERVER = 'http://100.70.34.122:3001';

type ProgressStatus = 'idle' | 'analyzing' | 'compressing' | 'uploading' | 'converting' | 'processing' | 'done' | 'error';

interface Progress {
  status: ProgressStatus;
  message: string;
  details?: string;
}

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  accept?: string;
}

interface UploadResponse {
  success: boolean;
  url: string;
  filename: string;
  error?: string;
  summary?: string;
  keyPoints?: string[];
  flashcards?: Array<{ question: string; answer: string; }>;
  transcript?: string;
}

export function FileUpload({ onFileSelect, accept = "video/*" }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ 
    status: 'idle', 
    message: '' 
  })
  const [uploadGlow, setUploadGlow] = useState(false)

  // Reset video error when URL changes
  useEffect(() => {
    setVideoError(null)
  }, [processedUrl])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Reset states
    setVideoError(null)
    setProcessedUrl(null)

    // If onFileSelect prop is provided, use it and bypass default upload
    if (onFileSelect) {
      onFileSelect(selectedFile)
      return
    }

    setFile(selectedFile)
    setUploading(true)
    setUploadGlow(true)

    try {
      // Show original file size
      setProgress({ 
        status: 'analyzing', 
        message: 'Analyzing video...',
        details: `Original size: ${formatBytes(selectedFile.size)}`
      })

      // Check if compression is needed
      const needsCompression = await shouldCompress(selectedFile);
      
      let fileToUpload: File;
      if (needsCompression) {
        setProgress({ 
          status: 'compressing', 
          message: 'Compressing video...',
          details: `Original size: ${formatBytes(selectedFile.size)}`
        })
        
        // Compress video and create a proper File object
        const compressedBlob = await compressVideo(selectedFile, {
          maxWidth: 1280,
          maxHeight: 720,
          targetSize: 1080,
          quality: 0.85
        });

        // Create a new File from the blob, maintaining the original filename
        const filename = selectedFile.name;
        const extension = filename.split('.').pop();
        // Ensure we output as MP4
        const newFilename = filename.replace(`.${extension}`, '_compressed.mp4');
        fileToUpload = new File([compressedBlob], newFilename, {
          type: 'video/mp4'
        });

        setProgress({ 
          status: 'uploading', 
          message: 'Uploading compressed video...',
          details: `Compressed size: ${formatBytes(fileToUpload.size)} (${Math.round(fileToUpload.size / selectedFile.size * 100)}% of original)`
        })
      } else {
        fileToUpload = selectedFile;
        setProgress({ 
          status: 'uploading', 
          message: 'Uploading video...',
          details: `File size: ${formatBytes(selectedFile.size)} (compression not needed)`
        });
      }

      const formData = new FormData()
      formData.append('video', fileToUpload)

      const response = await fetch(`${PI_SERVER}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'omit'
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data: UploadResponse = await response.json()
      
      if (data.success) {
        setProcessedUrl(data.url)
        
        // Check if file needs conversion (.mov)
        if (fileToUpload.name.toLowerCase().endsWith('.mov')) {
          setProgress({ 
            status: 'converting', 
            message: 'Converting video format for web compatibility...' 
          })
        } else {
          setProgress({ 
            status: 'processing', 
            message: 'Video uploaded successfully! Processing...' 
          })
        }
        
        // Short delay to show processing state
        setTimeout(() => {
          setProgress({ 
            status: 'done', 
            message: 'Video processed successfully! Ready to play.' 
          })
        }, 2000)
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Operation failed:', error)
      setProgress({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Operation failed' 
      })
    } finally {
      setUploading(false)
      setTimeout(() => setUploadGlow(false), 1000)
    }
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.target as HTMLVideoElement;
    const error = videoElement.error;
    let errorMessage = 'Error loading video';
    
    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Video playback was aborted';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'A network error occurred while loading the video';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Video format is not supported';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format or MIME type is not supported';
          break;
      }
    }
    
    console.error('Video loading error:', errorMessage, error);
    setVideoError(errorMessage);
  
    // Attempt to reload the video with explicit type
    if (videoElement && processedUrl) {
      videoElement.src = processedUrl;
      if (processedUrl.endsWith('.mp4')) {
        videoElement.setAttribute('type', 'video/mp4');
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {uploadGlow && (
        <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
          <div className="w-[500%] h-[150%] rounded-full bg-blue-300/30 blur-3xl scale-0 animate-[glow_1s_ease-out]"></div>
        </div>
      )}
      
      <div className="relative w-full max-w-4xl bg-black aspect-[36/9] border border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors rounded-lg p-8">
        <input
          type="file"
          id="video-upload"
          className="hidden"
          accept={accept}
          onChange={handleUpload}
          disabled={uploading}
        />
        <label
          htmlFor="video-upload"
          className="flex flex-col items-center cursor-pointer"
        >
          {progress.status === 'uploading' || 
           progress.status === 'processing' || 
           progress.status === 'compressing' || 
           progress.status === 'analyzing' ||
           progress.status === 'converting' ? (
            <Loader2 className="w-8 h-8 mb-4 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
          )}
          <span className="text-base mb-1">
            {progress.status === 'idle' 
              ? "Drop your lecture video here"
              : progress.message
            }
          </span>
          <span className="text-sm text-muted-foreground">
            MP4, WebM, or MOV up to 2GB
          </span>
        </label>
        
        {file && (
          <div className="mt-4 text-sm text-muted-foreground">
            Selected: {file.name}
          </div>
        )}
        
        {progress.status !== 'idle' && (
          <div className="flex flex-col gap-1">
            <div className={`mt-4 text-sm ${
              progress.status === 'error' ? 'text-red-500' : 
              progress.status === 'done' ? 'text-green-500' : 
              'text-blue-500'
            }`}>
              {progress.message}
            </div>
            {progress.details && (
              <div className="text-sm text-muted-foreground">
                {progress.details}
              </div>
            )}
          </div>
        )}
      </div>

      {processedUrl && progress.status === 'done' && (
        <div className="w-full max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Processed Video</h2>
          <video 
            src={processedUrl}
            controls 
            preload="auto"
            className="w-full rounded-lg shadow-lg"
            onError={handleVideoError}
          />
          {videoError && (
            <div className="mt-2 text-sm text-red-500">
              {videoError}
              <button 
                onClick={() => {
                  // Force reload the video
                  const video = document.querySelector('video');
                  if (video) {
                    video.load();
                    video.play();
                  }
                }}
                className="ml-2 text-blue-500 hover:text-blue-600"
              >
                Retry
              </button>
            </div>
          )}
          <div className="mt-2 text-sm text-muted-foreground">
            Video URL: {processedUrl}
          </div>
        </div>
      )}
    </div>
  )
}