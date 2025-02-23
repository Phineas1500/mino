"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react"
import { Roboto_Mono } from "next/font/google"

interface Segment {
  start: number
  end: number
  text: string
}

interface Flashcard {
  question: string
  answer: string
}

interface LessonData {
  summary: string
  keyPoints: string[]
  flashcards: Flashcard[]
  transcript: string
  segments: Segment[]
}

interface VideoState {
  url: string | null
  error: string | null
}

const defaultLessonData: LessonData = {
  summary: "",
  keyPoints: [],
  flashcards: [],
  transcript: "",
  segments: []
}

const robotoMono = Roboto_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
})

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
)

const LoadingPulse = () => (
  <div className="space-y-3">
    <div className="h-4 bg-zinc-700 rounded animate-pulse"></div>
    <div className="h-4 bg-zinc-700 rounded animate-pulse w-5/6"></div>
    <div className="h-4 bg-zinc-700 rounded animate-pulse w-4/6"></div>
  </div>
)

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

const VideoPlayer = ({ 
  type, 
  video, 
  onError, 
  videoRef 
}: { 
  type: 'original' | 'shortened'
  video: VideoState
  onError: (type: 'original' | 'shortened', error: string) => void
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
}) => {
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget
    const error = video.error
    
    let errorMessage = 'Failed to load video'
    if (error?.message) {
      errorMessage += `: ${error.message}`
    }
    
    onError(type, errorMessage)
  }

  if (video.error) {
    return (
      <div className="w-full aspect-video bg-zinc-900 rounded-lg flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-red-500 mb-2">{video.error}</p>
          <div className="text-sm text-gray-400 mb-4">
            If the problem persists, try uploading the video again.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return video.url ? (
    <video 
      ref={videoRef}
      key={type}
      src={video.url} 
      controls 
      className="w-full aspect-video"
      onError={handleVideoError}
      onLoadStart={() => console.log(`Starting to load ${type} video...`)}
      onLoadedData={() => console.log(`${type} video loaded successfully`)}
    />
  ) : null
}

export default function VideoPage() {
  const originalVideoRef = useRef<HTMLVideoElement>(null)
  const shortenedVideoRef = useRef<HTMLVideoElement>(null)
  const [originalVideo, setOriginalVideo] = useState<VideoState>({ url: null, error: null })
  const [shortenedVideo, setShortenedVideo] = useState<VideoState>({ url: null, error: null })
  const [currentFlashcard, setCurrentFlashcard] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lessonData, setLessonData] = useState<LessonData>(defaultLessonData)
  const [activeVideo, setActiveVideo] = useState<'original' | 'shortened'>('original')
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false)

  useEffect(() => {
    const loadData = () => {
      try {
        // Load video URLs
        const originalUrl = sessionStorage.getItem("videoUrl")
        const shortenedUrl = sessionStorage.getItem("shortenedUrl")
        
        console.log("Loading URLs from session storage:", {
          originalUrl,
          shortenedUrl,
          originalExists: !!originalUrl,
          shortenedExists: !!shortenedUrl
        })

        if (!originalUrl && !shortenedUrl) {
          console.error("No video URLs found in session storage")
        }
        
        setOriginalVideo({ url: originalUrl, error: null })
        setShortenedVideo({ url: shortenedUrl, error: null })

        // Load lesson data
        const storedLessonData = sessionStorage.getItem("lessonData")
        if (storedLessonData) {
          const parsedData = JSON.parse(storedLessonData)
          setLessonData({
            summary: parsedData.summary || "",
            keyPoints: parsedData.keyPoints || [],
            flashcards: parsedData.flashcards || [],
            transcript: parsedData.transcript || "",
            segments: parsedData.segments || []
          })
        }
      } catch (error) {
        console.error('Error loading data from session storage:', error)
      }
    }

    loadData()

    // Add storage event listener to handle updates
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "videoUrl") {
        setOriginalVideo(prev => ({ ...prev, url: event.newValue }))
      } else if (event.key === "shortenedUrl") {
        setShortenedVideo(prev => ({ ...prev, url: event.newValue }))
      } else if (event.key === "lessonData") {
        try {
          const newData = event.newValue ? JSON.parse(event.newValue) : null
          if (newData) {
            setLessonData(newData)
          }
        } catch (error) {
          console.error('Error parsing updated lesson data:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleVideoError = (type: 'original' | 'shortened', errorMessage: string) => {
    if (type === 'original') {
      setOriginalVideo(prev => ({ ...prev, error: errorMessage }))
    } else {
      setShortenedVideo(prev => ({ ...prev, error: errorMessage }))
    }
  }

  const handleTimestampClick = (time: number) => {
    const currentRef = activeVideo === 'original' ? originalVideoRef : shortenedVideoRef
    if (currentRef.current) {
      currentRef.current.currentTime = time
      currentRef.current.play()
    }
  }

  const nextFlashcard = () => {
    if (!lessonData.flashcards.length) return
    setCurrentFlashcard((prev) => 
      prev === lessonData.flashcards.length - 1 ? 0 : prev + 1
    )
    setShowAnswer(false)
  }

  const prevFlashcard = () => {
    if (!lessonData.flashcards.length) return
    setCurrentFlashcard((prev) => 
      prev === 0 ? lessonData.flashcards.length - 1 : prev - 1
    )
    setShowAnswer(false)
  }

  if (!originalVideo.url && !shortenedVideo.url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-xl text-gray-400 mb-4">No video to display</div>
        <div className="text-sm text-gray-500">Upload a video first</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto">
        {/* Branding Header */}
        <div className="w-full flex items-center justify-center gap-2 md:gap-4 mb-8">
          <div className={`text-2xl md:text-4xl font-medium tracking-tight ${robotoMono.className}`}>min</div>
          <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">(</div>
          <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">)</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Video Lesson</h1>
              {shortenedVideo.url && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveVideo('original')}
                    className={`px-4 py-2 rounded ${
                      activeVideo === 'original' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-700 text-gray-300'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setActiveVideo('shortened')}
                    className={`px-4 py-2 rounded ${
                      activeVideo === 'shortened' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-700 text-gray-300'
                    }`}
                  >
                    Shortened
                  </button>
                </div>
              )}
            </div>
            
            {/* Video Player */}
            <div className="rounded-lg overflow-hidden bg-black">
              <VideoPlayer 
                type={activeVideo}
                video={activeVideo === 'original' ? originalVideo : shortenedVideo}
                onError={handleVideoError}
                videoRef={activeVideo === 'original' ? originalVideoRef : shortenedVideoRef}
              />
            </div>

            {/* Summary */}
            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Summary</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : (
                <div className="text-gray-300">
                  {lessonData?.summary || "No summary available"}
                </div>
              )}
            </div>

            {/* Key Points */}
            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Key Points</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : (lessonData?.keyPoints && lessonData.keyPoints.length > 0) ? (
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  {lessonData.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-400">No key points available</div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Flashcards */}
            <div
              className={`bg-zinc-800 shadow rounded-lg p-6 transition-all duration-300 ${
                isTranscriptExpanded ? "hidden" : "block"
              }`}
            >
              <h2 className="text-xl font-semibold mb-4 text-white">Flashcards</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : (lessonData?.flashcards && lessonData.flashcards.length > 0) ? (
                <div className="space-y-4">
                  <div className="bg-zinc-700 p-6 rounded-lg min-h-[200px] flex flex-col justify-between">
                    <div className="text-gray-300">
                      <div className="font-semibold mb-2">Question:</div>
                      <div>{lessonData.flashcards[currentFlashcard]?.question}</div>
                      {showAnswer && (
                        <>
                          <div className="font-semibold mt-4 mb-2">Answer:</div>
                          <div>{lessonData.flashcards[currentFlashcard]?.answer}</div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <button
                        onClick={prevFlashcard}
                        className="p-2 text-gray-400 hover:text-white"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => setShowAnswer(!showAnswer)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {showAnswer ? "Hide Answer" : "Show Answer"}
                      </button>
                      <button
                        onClick={nextFlashcard}
                        className="p-2 text-gray-400 hover:text-white"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                  <div className="text-center text-gray-400">
                    Card {currentFlashcard + 1} of {lessonData.flashcards.length}
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">No flashcards available</div>
              )}
            </div>

            {/* Transcript */}
            <div className="bg-zinc-800 shadow rounded-lg">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-white">Transcript</h2>
                  <button
                    onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                    className="p-2 text-gray-400 hover:text-white rounded-lg"
                  >
                    {isTranscriptExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                </div>
                {isProcessing ? (
                  <LoadingPulse />
                ) : (
                  <div
                    className={`space-y-4 overflow-y-auto transition-all duration-300 ${
                      isTranscriptExpanded ? "h-[calc(100vh-16rem)]" : "h-[400px]"
                    }`}
                  >
                    {lessonData.segments.map((segment, index) => (
                      <div key={index} className="group">
                        <button
                          onClick={() => handleTimestampClick(segment.start)}
                          className="text-blue-400 hover:text-blue-300 font-mono text-sm mb-1 group-hover:opacity-100 opacity-70"
                        >
                          [{formatTimestamp(segment.start)}]
                        </button>
                        <span className="text-gray-300 ml-2">{segment.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}