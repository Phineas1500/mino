'use client'

import { useState } from "react"
import { Upload, Loader2 } from "lucide-react"

interface FileUploadProps {
  onFileSelect?: (file: File) => void
  onProcessingComplete?: (data: any) => void
  accept?: string
}

interface ProcessResponse {
  success: boolean
  error?: string
  originalUrl?: string
  shortenedUrl?: string
  data?: {
    transcript: string
    segments: any[]
    summary: string
    keyPoints: string[]
    flashcards: any[]
  }
}

export function FileUpload({ onFileSelect, onProcessingComplete, accept = "video/*" }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
    message: string
  }>({ status: 'idle', message: '' })
  const [uploadGlow, setUploadGlow] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFile(file)
    setUploading(true)
    setUploadGlow(true)
    setProgress({ status: 'uploading', message: 'Getting upload URL...' })

    try {
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
              fileName: file.name,
              fileType: file.type
            })
          })
          if (urlResponse.ok) break
        } catch (error) {
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

      // Step 2: Upload to S3 with retry logic
      let uploadResponse: Response | undefined
      retries = 3
      while (retries > 0) {
        try {
          uploadResponse = await fetch(url, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type
            }
          })
          if (uploadResponse.ok) break
        } catch (error) {
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
      let processResponse: Response | undefined
      retries = 3
      while (retries > 0) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 300000) // 5-minute timeout

          processResponse = await fetch('/api/process-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileKey: fields.key
            }),
            signal: controller.signal
          })

          clearTimeout(timeout)
          if (processResponse.ok) break
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
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
      
      if (!processResult.originalUrl || !processResult.shortenedUrl) {
        console.error('Missing URL values:', {
          originalUrl: processResult.originalUrl,
          shortenedUrl: processResult.shortenedUrl
        })
        throw new Error('Failed to get video URLs from processing')
      }
      
      sessionStorage.setItem("videoUrl", processResult.originalUrl)
      sessionStorage.setItem("shortenedUrl", processResult.shortenedUrl)
      
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
      
      window.location.href = '/video'
      
    } catch (error) {
      console.error('Upload/processing failed:', error)
      setProgress({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Upload failed' 
      })
    } finally {
      setUploading(false)
      setTimeout(() => setUploadGlow(false), 1000)
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
          <div className={`mt-4 text-sm ${
            progress.status === 'error' ? 'text-red-500' : 
            progress.status === 'done' ? 'text-green-500' : 
            'text-blue-500'
          }`}>
            {progress.message}
          </div>
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