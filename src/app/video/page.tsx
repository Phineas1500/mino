"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Roboto_Mono } from "next/font/google"
import { Maximize2, Minimize2 } from "lucide-react"

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

const defaultLessonData: LessonData = {
  summary: "",
  keyPoints: [],
  flashcards: [],
  transcript: "",
  segments: [],
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

export default function VideoPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [currentFlashcard, setCurrentFlashcard] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lessonData, setLessonData] = useState<LessonData>(defaultLessonData)
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false)

  useEffect(() => {
    // Load video URL and lesson data from session storage
    const loadData = () => {
      try {
        const storedUrl = sessionStorage.getItem("videoUrl")
        console.log("Loaded URL from session storage:", storedUrl)

        if (storedUrl) {
          setVideoUrl(storedUrl)
        }

        const storedLessonData = sessionStorage.getItem("lessonData")
        console.log("Loaded lesson data from session storage:", storedLessonData)

        if (storedLessonData) {
          const parsedData = JSON.parse(storedLessonData)
          console.log("Parsed lesson data:", parsedData)
          setLessonData({
            summary: parsedData.summary || "",
            keyPoints: parsedData.keyPoints || [],
            flashcards: parsedData.flashcards || [],
            transcript: parsedData.transcript || "",
            segments: parsedData.segments || [],
          })
        }
      } catch (error) {
        console.error("Error loading data from session storage:", error)
      }
    }

    loadData()

    // Add storage event listener to handle updates
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "videoUrl") {
        console.log("Video URL updated in storage:", event.newValue)
        setVideoUrl(event.newValue)
      } else if (event.key === "lessonData") {
        try {
          const newData = event.newValue ? JSON.parse(event.newValue) : null
          if (newData) {
            setLessonData(newData)
          }
        } catch (error) {
          console.error("Error parsing updated lesson data:", error)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const handleTranscriptUpdate = async (data: any) => {
    try {
      setIsProcessing(true)

      // If we already have processed data in the response
      if (data.summary && data.keyPoints && data.flashcards) {
        const processedData: LessonData = {
          summary: data.summary,
          keyPoints: data.keyPoints,
          flashcards: data.flashcards,
          transcript: data.transcript,
          segments: data.segments || [],
        }
        sessionStorage.setItem("lessonData", JSON.stringify(processedData))
        setLessonData(processedData)
        return
      }

      // If we need to process the transcript
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: data.transcript }),
      })

      if (!response.ok) throw new Error("Failed to process transcript")

      const result = await response.json()
      if (result.success && result.data) {
        const processedData: LessonData = {
          summary: result.data.summary || "",
          keyPoints: result.data.keyPoints || [],
          flashcards: result.data.flashcards || [],
          transcript: result.data.transcript || data.transcript || "",
          segments: result.data.segments || data.segments || [],
        }

        sessionStorage.setItem("lessonData", JSON.stringify(processedData))
        setLessonData(processedData)
      }
    } catch (error) {
      console.error("Error updating transcript:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const nextFlashcard = () => {
    if (!lessonData.flashcards.length) return
    setCurrentFlashcard((prev) => (prev === lessonData.flashcards.length - 1 ? 0 : prev + 1))
    setShowAnswer(false)
  }

  const prevFlashcard = () => {
    if (!lessonData.flashcards.length) return
    setCurrentFlashcard((prev) => (prev === 0 ? lessonData.flashcards.length - 1 : prev - 1))
    setShowAnswer(false)
  }

  const handleTimestampClick = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      videoRef.current.play()
    }
  }

  if (!videoUrl) {
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
            </div>

            {/* Video Player */}
            <div className="rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full aspect-video"
                onError={(e) => console.error("Video error:", e)}
              />
            </div>

            {/* Summary */}
            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Summary</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : (
                <div className="text-gray-300">{lessonData?.summary || "No summary available"}</div>
              )}
            </div>

            {/* Key Points */}
            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Key Points</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : lessonData?.keyPoints && lessonData.keyPoints.length > 0 ? (
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
              ) : lessonData?.flashcards && lessonData.flashcards.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-gray-700 p-6 rounded-lg min-h-[200px] flex flex-col justify-between">
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
                      <button onClick={prevFlashcard} className="p-2 text-gray-400 hover:text-white">
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => setShowAnswer(!showAnswer)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {showAnswer ? "Hide Answer" : "Show Answer"}
                      </button>
                      <button onClick={nextFlashcard} className="p-2 text-gray-400 hover:text-white">
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

