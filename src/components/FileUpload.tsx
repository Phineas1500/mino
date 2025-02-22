'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFile(file)
    setUploading(true)

    try {
      // TODO: Implement file upload and processing
      // 1. Upload to temporary storage
      // 2. Process with AI
      // 3. Return results
      console.log('File selected:', file.name)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <input
        type="file"
        id="video-upload"
        className="hidden"
        accept="video/*"
        onChange={handleUpload}
        disabled={uploading}
      />
      <label
        htmlFor="video-upload"
        className="flex flex-col items-center cursor-pointer"
      >
        <Upload className="w-12 h-12 mb-4 text-gray-500" />
        <span className="text-lg mb-2">
          {uploading ? 'Uploading...' : 'Upload your lecture video'}
        </span>
        <span className="text-sm text-gray-500">
          MP4, WebM, or MOV up to 2GB
        </span>
      </label>
      {file && (
        <div className="mt-4 text-sm text-gray-600">
          Selected: {file.name}
        </div>
      )}
    </div>
  )
}