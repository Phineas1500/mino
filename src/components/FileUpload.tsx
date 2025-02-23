'use client'

import { useState } from "react"
import { Upload, Loader2 } from "lucide-react"

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  onProcessingComplete?: (data: any) => void;
  accept?: string;
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
      // Step 1: Get presigned URL from Pi
      const urlResponse = await fetch('/api/s3/presigned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type
        })
      })
  
      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL')
      }
  
      const { url, fields } = await urlResponse.json()
      console.log('Received presigned URL:', url)
      console.log('Fields:', fields)
      
      setProgress({ status: 'uploading', message: 'Uploading to S3...' })
  
      // Step 2: Upload to S3 using PUT
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })
  
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('S3 upload failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          errorText
        })
        throw new Error(`Failed to upload to S3: ${uploadResponse.statusText}`)
      }
  
      // Step 3: Notify Pi that upload is complete
      setProgress({ status: 'processing', message: 'Processing video...' })
      const processResponse = await fetch('/api/process-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileKey: fields.key
        })
      })
  
      if (!processResponse.ok) {
        throw new Error('Failed to process video')
      }
  
      const processResult = await processResponse.json()
      
      if (processResult.success) {
        console.log('Received video URL:', processResult.url)
        sessionStorage.setItem("videoUrl", processResult.url)
        
        if (processResult.data) {
          console.log('Received lesson data:', processResult.data)
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
        
        setProcessedUrl(processResult.url)
        setProgress({ status: 'done', message: 'Video processed successfully!' })
        
        // Navigate to video page
        window.location.href = '/video'
      } else {
        throw new Error(processResult.error || 'Processing failed')
      }
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
      <div className="relative w-full max-w-4xl bg-black aspect-[36/9] border border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors rounded-lg p-8" >
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