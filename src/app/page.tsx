import { FileUpload } from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Mino</h1>
        <p className="text-lg mb-8">
          Upload your lecture videos and let AI create a concise summary with timestamps.
        </p>
        <FileUpload />
      </div>
    </main>
  )
}