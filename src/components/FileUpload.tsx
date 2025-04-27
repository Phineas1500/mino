'use client'

import { useState, useRef } from "react"
import { Upload, Loader2 } from "lucide-react"
import { compressVideo, shouldCompress } from '../components/videoCompressor';
import { useRouter } from 'next/navigation';

interface FileUploadProps {
  onFileSelect?: (file: File) => void
  onProcessingComplete?: (data: any) => void
  accept?: string
}

interface ProcessResponse {
  success: boolean
  error?: string
  originalUrl?: string
  data?: {
    transcript: string
    segments: any[]
    summary: string
    keyPoints: string[]
    flashcards: any[]
  }
}

export function FileUpload({ onFileSelect, onProcessingComplete, accept = "video/*" }: FileUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
    message: string
  }>({ status: 'idle', message: '' })
  const [uploadGlow, setUploadGlow] = useState(false)
  
  // Add refs to store abort controllers
  const uploadAbortController = useRef<AbortController | null>(null)
  const processAbortController = useRef<AbortController | null>(null)

  const handleCancel = () => {
    // Abort any ongoing requests
    uploadAbortController.current?.abort()
    processAbortController.current?.abort()
    
    // Reset state
    setProgress({ status: 'idle', message: '' })
    setUploading(false)
    setFile(null)
    setUploadGlow(false)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const compressedBlob = await shouldCompress(file) 
      ? await compressVideo(file)
      : file;

    const compressedFile = new File(
      [compressedBlob], 
      file.name, 
      { type: file.type, lastModified: file.lastModified }
    );

    setFile(compressedFile)
    setUploading(true)
    setUploadGlow(true)
    setProgress({ status: 'uploading', message: 'Getting upload URL...' })

    try {
      // Create new abort controller for this upload
      uploadAbortController.current = new AbortController()

      // Step 1: Get presigned URL with retry logic
      let urlResponse: Response | undefined
      let retries = 3
      while (retries > 0) {
        try {
          urlResponse = await fetch('/api/s3/presigned', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: compressedFile.name,
              fileType: compressedFile.type
            }),
            signal: uploadAbortController.current.signal
          })
          if (urlResponse.ok) break
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Upload cancelled')
          }
          console.warn(`Attempt ${4 - retries} failed, retrying...`)
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      if (!urlResponse?.ok) {
        const errorData = await urlResponse?.text()
        throw new Error(`Failed to get upload URL: ${errorData}`)
      }

      const { url, fields } = await urlResponse.json()
      console.log('Received presigned URL:', url)
      
      setProgress({ status: 'uploading', message: 'Uploading to S3...' })

      // Step 2: Upload to S3 with retry logic and abort signal
      let uploadResponse: Response | undefined
      retries = 3
      while (retries > 0) {
        try {
          uploadResponse = await fetch(url, {
            method: 'PUT',
            body: compressedFile,
            headers: {
              'Content-Type': compressedFile.type
            },
            signal: uploadAbortController.current.signal
          })
          if (uploadResponse.ok) break
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Upload cancelled')
          }
          console.warn(`Upload attempt ${4 - retries} failed, retrying...`)
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      if (!uploadResponse?.ok) {
        const errorText = await uploadResponse?.text()
        throw new Error(`Failed to upload to S3: ${errorText}`)
      }

      // Step 3: Process the video with timeout and retry logic
      setProgress({ status: 'processing', message: 'Processing video...' })
      processAbortController.current = new AbortController()
      let processResponse: Response | undefined
      retries = 3
      while (retries > 0) {
        try {
          const timeout = setTimeout(() => processAbortController.current?.abort(), 300000) // 5-minute timeout

          processResponse = await fetch('/api/process-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileKey: fields.key
            }),
            signal: processAbortController.current.signal
          })

          clearTimeout(timeout)
          if (processResponse.ok) break
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            if (processAbortController.current?.signal.aborted) {
              throw new Error('Processing cancelled')
            }
            throw new Error('Video processing timed out. Please try again with a shorter video.')
          }
          console.warn(`Processing attempt ${4 - retries} failed, retrying...`)
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      if (!processResponse) {
        throw new Error('Failed to process video: No response received')
      }
      
      const processResult = await processResponse.json() as ProcessResponse
      console.log('Process result received:', processResult)
      
      if (!processResponse.ok || !processResult.success) {
        throw new Error(processResult.error || 'Failed to process video')
      }
      
      if (!processResult.originalUrl) {
        console.error('Missing originalUrl value:', {
          originalUrl: processResult.originalUrl
        })
        throw new Error('Failed to get video URL from processing')
      }
      
      // Store only the original URL now
      sessionStorage.setItem("videoUrl", processResult.originalUrl)
      
      // Use the same URL for both since we don't generate a shortened version anymore
      sessionStorage.setItem("shortenedUrl", processResult.originalUrl)
      
      if (processResult.data) {
        const lessonData = {
          transcript: processResult.data.transcript || "",
          segments: processResult.data.segments || [],
          summary: processResult.data.summary || "",
          keyPoints: processResult.data.keyPoints || [],
          flashcards: processResult.data.flashcards || []
        }
        sessionStorage.setItem("lessonData", JSON.stringify(lessonData))
        if (onProcessingComplete) {
          onProcessingComplete(lessonData)
        }
      }
            
      setProcessedUrl(processResult.originalUrl)
      setProgress({ status: 'done', message: 'Video processed successfully!' })
      
      router.push('/video'); 
      
    } catch (error) {
      console.error('Upload/processing failed:', error)
      setProgress({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Upload failed' 
      })
    } finally {
      setUploading(false)
      setTimeout(() => setUploadGlow(false), 1000)
      // Clear abort controllers
      uploadAbortController.current = null
      processAbortController.current = null
    }
  }

  const getProgressPercentage = () => {
    switch (progress.status) {
      case 'idle':
        return 0;
      case 'uploading':
        return 33;
      case 'processing':
        return 66;
      case 'done':
        return 100;
      case 'error':
        return 0;
      default:
        return 0;
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
          {progress.status === 'uploading' || progress.status === 'processing' ? (
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
          <>
            <div className="mt-4 flex items-center justify-between">
              <div className={`text-sm ${
                progress.status === 'error' ? 'text-red-500' : 
                progress.status === 'done' ? 'text-green-500' : 
                'text-blue-500'
              }`}>
                {progress.message}
              </div>
              {(progress.status === 'uploading' || progress.status === 'processing') && (
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm text-red-500 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            {progress.status !== 'error' && (
              <div className="w-full mt-4">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ease-out rounded-full ${
                      progress.status === 'done' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ 
                      width: `${getProgressPercentage()}%`,
                      transition: 'width 0.5s ease-out'
                    }}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  {getProgressPercentage()}%
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {processedUrl && progress.status === 'done' && (
        <div className="w-full max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Processed Video</h2>
          <video 
            src={processedUrl} 
            controls 
            className="w-full rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  )
}