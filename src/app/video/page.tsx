"use client"
import Link from "next/link";
import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Play, Zap } from "lucide-react"
import { Roboto_Mono } from "next/font/google"

interface Segment {
  start: number
  end: number
  text: string
  can_skip: boolean
  importance_score: number
  playback_speed: number
  original_duration: number
  adjusted_duration: number
  reason: string
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
  stats: {
    total_segments: number
    skippable_segments: number
    total_duration: number
    skippable_duration: number
    skippable_percentage: number
    time_saved_percentage: number  // Added this field
  }
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
  segments: [],
  stats: {
    total_segments: 0,
    skippable_segments: 0,
    total_duration: 0,
    skippable_duration: 0,
    skippable_percentage: 0,
    time_saved_percentage: 0  // Added this field
  }
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
  segments,
  videoRef 
}: { 
  type: 'original' | 'turbo'
  video: VideoState
  onError: (type: 'original' | 'turbo', error: string) => void
  segments: Segment[]
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
}) => {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedAdjustedTime, setSpeedAdjustedTime] = useState(0)
  const [speedAdjustedDuration, setSpeedAdjustedDuration] = useState(0)

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget
    const error = video.error
    
    let errorMessage = 'Failed to load video'
    if (error?.message) {
      errorMessage += `: ${error.message}`
    }
    
    onError(type, errorMessage)
  }

  // Calculate speed adjusted time based on segments
  const calculateSpeedAdjustedTime = (currentTime: number) => {
    let adjustedTime = 0
    let timeAccumulator = 0

    for (const segment of segments) {
      const segmentDuration = segment.end - segment.start
      
      if (currentTime <= segment.start) {
        break
      } else if (currentTime >= segment.end) {
        timeAccumulator += segmentDuration / segment.playback_speed
      } else {
        // We're in this segment
        const timeInSegment = currentTime - segment.start
        timeAccumulator += timeInSegment / segment.playback_speed
      }
    }

    return timeAccumulator
  }

  // Calculate total speed adjusted duration
  const calculateSpeedAdjustedDuration = () => {
    return segments.reduce((total, segment) => {
      const segmentDuration = segment.end - segment.start
      return total + (segmentDuration / segment.playback_speed)
    }, 0)
  }

  // Update playback speed based on current time
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget
    const currentTime = video.currentTime
    setCurrentTime(currentTime)
    
    // Only adjust speed and calculations for turbo mode
    if (type === 'turbo') {
      // Find the current segment
      const currentSegment = segments.find(
        seg => currentTime >= seg.start && currentTime < seg.end
      )
      
      if (currentSegment) {
        // Only update if speed needs to change
        if (video.playbackRate !== currentSegment.playback_speed) {
          video.playbackRate = currentSegment.playback_speed
        }
      }

      // Update speed adjusted time
      setSpeedAdjustedTime(calculateSpeedAdjustedTime(currentTime))
    }
  }

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget
    setDuration(video.duration)
    if (type === 'turbo') {
      setSpeedAdjustedDuration(calculateSpeedAdjustedDuration())
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
    <div className="relative">
      <video 
        ref={videoRef}
        key={type}
        src={video.url} 
        controls 
        className="w-full aspect-video"
        onError={handleVideoError}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={() => console.log(`Starting to load ${type} video...`)}
        onLoadedData={() => console.log(`${type} video loaded successfully`)}
      />
      {type === 'turbo' && (
        <div className="absolute bottom-14 right-4 bg-black/80 px-3 py-1 rounded text-sm font-mono">
          <span className="text-gray-400">Actual: </span>
          <span className="text-white">{formatTime(speedAdjustedTime)}</span>
          <span className="text-gray-400"> / </span>
          <span className="text-white">{formatTime(speedAdjustedDuration)}</span>
        </div>
      )}
    </div>
  ) : null
}

export default function VideoPage() {
  const originalVideoRef = useRef<HTMLVideoElement>(null)
  const turboVideoRef = useRef<HTMLVideoElement>(null)
  const [originalVideo, setOriginalVideo] = useState<VideoState>({ url: null, error: null })
  const [turboVideo, setTurboVideo] = useState<VideoState>({ url: null, error: null })
  const [currentFlashcard, setCurrentFlashcard] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lessonData, setLessonData] = useState<LessonData>(defaultLessonData)
  const [activeVideo, setActiveVideo] = useState<'original' | 'turbo'>('original')
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    const loadData = () => {
      try {
        // Load video URLs
        const originalUrl = sessionStorage.getItem("videoUrl")
        const turboUrl = sessionStorage.getItem("turboUrl")
        
        console.log("Loading URLs from session storage:", {
          originalUrl,
          turboUrl,
          originalExists: !!originalUrl,
          turboExists: !!turboUrl
        })

        if (!originalUrl && !turboUrl) {
          console.error("No video URLs found in session storage")
        }
        
        setOriginalVideo({ url: originalUrl, error: null })
        setTurboVideo({ url: turboUrl, error: null })

        // Load lesson data
        const storedLessonData = sessionStorage.getItem("lessonData")
        if (storedLessonData) {
          const parsedData = JSON.parse(storedLessonData)
          setLessonData({
            summary: parsedData.summary || "",
            keyPoints: parsedData.keyPoints || [],
            flashcards: parsedData.flashcards || [],
            transcript: parsedData.transcript || "",
            segments: parsedData.segments || [],
            stats: {
              total_segments: parsedData.stats?.total_segments || 0,
              skippable_segments: parsedData.stats?.skippable_segments || 0,
              total_duration: parsedData.stats?.total_duration || 0,
              skippable_duration: parsedData.stats?.skippable_duration || 0,
              skippable_percentage: parsedData.stats?.skippable_percentage || 0,
              time_saved_percentage: parsedData.stats?.time_saved_percentage || 0
            }
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
      } else if (event.key === "lessonData") {
        try {
          const newData = event.newValue ? JSON.parse(event.newValue) : defaultLessonData
          if (newData) {
            setLessonData({
              summary: newData.summary || "",
              keyPoints: newData.keyPoints || [],
              flashcards: newData.flashcards || [],
              transcript: newData.transcript || "",
              segments: newData.segments || [],
              stats: {
                total_segments: newData.stats?.total_segments || 0,
                skippable_segments: newData.stats?.skippable_segments || 0,
                total_duration: newData.stats?.total_duration || 0,
                skippable_duration: newData.stats?.skippable_duration || 0,
                skippable_percentage: newData.stats?.skippable_percentage || 0,
                time_saved_percentage: newData.stats?.time_saved_percentage || 0
              }
            })
          }
        } catch (error) {
          console.error('Error parsing updated lesson data:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    if (lessonData.segments.length > 0) {
      const total_segments = lessonData.segments.length;
      const skippable_segments = lessonData.segments.filter(segment => segment.can_skip).length;
      const total_duration = lessonData.segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0);
      const skippable_duration = lessonData.segments.reduce((sum, segment) => 
        segment.can_skip ? sum + (segment.end - segment.start) : sum, 0);
      const skippable_percentage = total_duration ? (skippable_duration / total_duration) * 100 : 0;
      
      // Calculate time saved based on playback speeds
      const original_time = lessonData.segments.reduce((sum, segment) => 
        sum + (segment.end - segment.start), 0);
      const adjusted_time = lessonData.segments.reduce((sum, segment) => 
        sum + (segment.end - segment.start) / segment.playback_speed, 0);
      const time_saved_percentage = ((original_time - adjusted_time) / original_time) * 100;

      // Only update if stats have changed
      if (
        lessonData.stats.total_segments !== total_segments ||
        lessonData.stats.skippable_segments !== skippable_segments ||
        lessonData.stats.total_duration !== total_duration ||
        lessonData.stats.skippable_duration !== skippable_duration ||
        lessonData.stats.skippable_percentage !== skippable_percentage ||
        lessonData.stats.time_saved_percentage !== time_saved_percentage
      ) {
        setLessonData(prev => ({
          ...prev,
          stats: {
            total_segments,
            skippable_segments,
            total_duration,
            skippable_duration,
            skippable_percentage,
            time_saved_percentage
          }
        }));
      }
    }
  }, [lessonData.segments]);

  const handleVideoError = (type: 'original' | 'turbo', errorMessage: string) => {
    if (type === 'original') {
      setOriginalVideo(prev => ({ ...prev, error: errorMessage }))
    } else {
      setTurboVideo(prev => ({ ...prev, error: errorMessage }))
    }
  }

  const handleTimestampClick = (time: number) => {
    const currentRef = activeVideo === 'original' ? originalVideoRef : turboVideoRef
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
  

  if (!originalVideo.url && !turboVideo.url) {
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
      <Link href="/">
        <div className="w-full flex items-center justify-center gap-2 md:gap-4 mb-8 cursor-pointer">
          <div className={`text-2xl md:text-4xl font-medium tracking-tight ${robotoMono.className}`}>min</div>
          <div className="flex items-center gap-0 text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">
            <span>(</span>
            <ChevronLeft className="w-12 h-12 opacity-50 relative top-[5px]" />
            <span>)</span>
          </div>
        </div>
      </Link>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Video Lesson</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveVideo('original')}
                  className={`px-4 py-2 rounded flex items-center gap-2 ${
                    activeVideo === 'original' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Original
                </button>
                <button
                  onClick={() => setActiveVideo('turbo')}
                  className={`px-4 py-2 rounded flex items-center gap-2 ${
                    activeVideo === 'turbo'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' 
                      : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                  }`}
                >
                  <Zap className={`w-4 h-4 ${activeVideo === 'turbo' ? 'animate-pulse' : ''}`} />
                  Turbo
                </button>
              </div>
            </div>
            
            {/* Video Player */}
            <div className="rounded-lg overflow-hidden bg-black">
              <VideoPlayer 
                type={activeVideo}
                video={originalVideo}
                onError={handleVideoError}
                segments={lessonData.segments}
                videoRef={activeVideo === 'original' ? originalVideoRef : turboVideoRef}
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

            {/* Statistics */}
            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Analysis</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Original Duration:</span>
                    <span className="text-gray-300">{formatTimestamp(lessonData.stats.total_duration)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Adjusted Duration:</span>
                    <span className="text-gray-300">{formatTimestamp(lessonData.stats.total_duration - (lessonData.stats.total_duration * lessonData.stats.time_saved_percentage / 100))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Time Saved:</span>
                    <span className="text-gray-300">{formatTimestamp(lessonData.stats.total_duration * lessonData.stats.time_saved_percentage / 100)} ({Math.round(lessonData.stats.time_saved_percentage)}%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Skippable Segments:</span>
                    <span className="text-gray-300">{lessonData.stats.skippable_segments} of {lessonData.stats.total_segments}</span>
                  </div>
                </div>
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
                      <div 
                        key={index} 
                        className={`group p-4 rounded-lg ${
                          segment.can_skip ? 'bg-zinc-700/50' : 'bg-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            onClick={() => handleTimestampClick(segment.start)}
                            className="text-blue-400 hover:text-blue-300 font-mono text-sm group-hover:opacity-100 opacity-70"
                          >
                            [{formatTimestamp(segment.start)}]
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              segment.importance_score >= 7 ? 'bg-green-600/30 text-green-200' :
                              segment.importance_score >= 4 ? 'bg-yellow-600/30 text-yellow-200' :
                              'bg-red-600/30 text-red-200'
                            }`}>
                              Score: {segment.importance_score}/10
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              segment.playback_speed <= 1.2 ? 'bg-green-600/30 text-green-200' :
                              segment.playback_speed <= 1.8 ? 'bg-yellow-600/30 text-yellow-200' :
                              'bg-red-600/30 text-red-200'
                            }`}>
                              {segment.playback_speed}x
                            </span>
                            {segment.can_skip && (
                              <span className="px-2 py-0.5 bg-yellow-600/30 text-yellow-200 text-xs rounded">
                                Skippable
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-300">{segment.text}</p>
                        <p className="mt-2 text-sm text-gray-400 italic">
                          {segment.reason}
                        </p>
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