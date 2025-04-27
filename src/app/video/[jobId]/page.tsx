"use client"
import Link from "next/link";
// Add useMemo to imports
import { useState, useEffect, useRef, useMemo } from "react" 
import { useParams } from 'next/navigation'; 
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
    time_saved_percentage: number
  }
}

interface VideoState {
  url: string | null
  error: string | null
}

// --- Add new TimeMapPoint interface ---
interface TimeMapPoint {
  actualTime: number;
  adjustedTime: number;
  segmentSpeed: number; // Speed *starting* at this actualTime
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
    time_saved_percentage: 0
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

interface VideoPlayerProps {
  type: 'original' | 'turbo'
  video: VideoState
  onError: (type: 'original' | 'turbo', error: string) => void
  segments: Segment[] // Keep segments for playbackRate adjustment
  precalculatedTimes: TimeMapPoint[] // <-- Add prop
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
  onDurationLoaded?: (duration: number) => void
}

const VideoPlayer = ({ 
  type, 
  video, 
  onError,
  segments, // Still needed for setting video.playbackRate
  precalculatedTimes, // <-- Receive prop
  videoRef,
  onDurationLoaded
}: VideoPlayerProps) => {
  useEffect(() => {
    console.log('VideoPlayer received segments prop:', JSON.stringify(segments || [], null, 2));
  }, [segments]); // Log whenever segments prop changes

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedAdjustedTime, setSpeedAdjustedTime] = useState(0)

  // --- Calculate speedAdjustedDuration using useMemo ---
  const speedAdjustedDuration = useMemo(() => {
      return precalculatedTimes.length > 0
          ? precalculatedTimes[precalculatedTimes.length - 1].adjustedTime
          : 0;
  }, [precalculatedTimes]);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget
    const error = video.error
    
    let errorMessage = 'Failed to load video'
    if (error?.message) {
      errorMessage += `: ${error.message}`
    }
    
    onError(type, errorMessage)
  }

  // --- REVISED calculateSpeedAdjustedTime ---
  const calculateSpeedAdjustedTime = (currentActualTime: number): number => { // Renamed input variable
    if (precalculatedTimes.length === 0) {
        return 0; // No map available
    }

    // Find the interval in the precalculated map where currentActualTime falls
    let basePoint: TimeMapPoint | null = null;
    // Iterate forward to find the last point whose actualTime is <= currentActualTime
    for (let i = 0; i < precalculatedTimes.length; i++) {
        if (precalculatedTimes[i].actualTime <= currentActualTime) {
            basePoint = precalculatedTimes[i];
        } else {
            // Stop as soon as we pass the currentActualTime
            break; 
        }
    }

    if (!basePoint) {
       // This should only happen if currentActualTime is negative or map is empty (handled above)
       console.warn(`Could not find base point for currentActualTime: ${currentActualTime}. Using first segment speed.`);
       const firstSpeed = precalculatedTimes[0]?.segmentSpeed || 1;
       return currentActualTime / firstSpeed; // Estimate based on first segment speed
    }

    // Time elapsed since the last calculated actualTime point
    const timeSinceBasePoint = currentActualTime - basePoint.actualTime;

    // Speed during the current interval (stored at the base point)
    // This speed applies from basePoint.actualTime onwards until the next point
    const currentSpeed = basePoint.segmentSpeed > 0 ? basePoint.segmentSpeed : 1;

    // Adjusted time elapsed since the base point
    const adjustedTimeSinceBasePoint = timeSinceBasePoint / currentSpeed;

    // Final adjusted time
    const finalAdjustedTime = basePoint.adjustedTime + adjustedTimeSinceBasePoint;

    // --- Add focused logging for debugging ---
    // console.log(`CalcAdjTime: Current=${currentActualTime.toFixed(2)}, BaseActual=${basePoint.actualTime.toFixed(2)}, BaseAdj=${basePoint.adjustedTime.toFixed(2)}, Speed=${currentSpeed}, AdjSinceBase=${adjustedTimeSinceBasePoint.toFixed(2)}, FinalAdj=${finalAdjustedTime.toFixed(2)}`);

    return finalAdjustedTime;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const currentActualTime = video.currentTime; // Use a different variable name
    setCurrentTime(currentActualTime); // Update state for original time display if needed

    if (type === 'turbo') {
        // --- Adjust Playback Rate (uses original segments array) ---
        // Find segment based on actual time
        const currentSegment = segments.find(
            // Use nullish coalescing for safety
            seg => currentActualTime >= (seg.start ?? 0) && currentActualTime < (seg.end ?? 0) 
        );
        
        // Determine target speed, default to 1 if no segment found or speed invalid
        // Check if currentSegment exists before accessing its properties
        let targetSpeed = 1; // Default speed
        if (currentSegment && currentSegment.playback_speed > 0) {
            targetSpeed = currentSegment.playback_speed;
        }
        
        if (video.playbackRate !== targetSpeed) {
            // console.log(`Adjusting playbackRate to ${targetSpeed} at ${currentActualTime.toFixed(2)}s`);
            video.playbackRate = targetSpeed;
        }

        // --- Calculate and Set Displayed Adjusted Time using the new function ---
        setSpeedAdjustedTime(calculateSpeedAdjustedTime(currentActualTime));
    } else {
        // Ensure original video plays at normal speed
        if (video.playbackRate !== 1) {
            video.playbackRate = 1;
        }
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const actualDuration = video.duration;
    setDuration(actualDuration);
    
    if (type === 'original' && onDurationLoaded) {
      onDurationLoaded(actualDuration);
    }
  };

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
          {/* Use the calculated duration from useMemo */}
          <span className="text-white">{formatTime(speedAdjustedDuration)}</span>
        </div>
      )}
    </div>
  ) : null
}

export default function VideoJobPage() { 
  const params = useParams(); 
  const jobId = params.jobId as string; 

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<LessonData>(defaultLessonData);
  const [originalVideo, setOriginalVideo] = useState<VideoState>({ url: null, error: null });
  const [turboVideo, setTurboVideo] = useState<VideoState>({ url: null, error: null });

  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const turboVideoRef = useRef<HTMLVideoElement>(null);
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [activeVideo, setActiveVideo] = useState<'original' | 'turbo'>('original');
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [actualVideoDuration, setActualVideoDuration] = useState<number | null>(null);

  // --- Add new state for precalculated times ---
  const [precalculatedTimes, setPrecalculatedTimes] = useState<TimeMapPoint[]>([]); 

  const handleVideoDurationLoaded = (duration: number) => {
    console.log(`Actual video duration loaded: ${duration}s`);
    setActualVideoDuration(duration);
    
    setLessonData(prev => {
      if (Math.abs(prev.stats.total_duration - duration) > 1) {
        const adjusted_time = prev.segments.reduce((sum, segment) => 
          sum + (segment.end - segment.start) / segment.playback_speed, 0);
        const time_saved_percentage = ((duration - adjusted_time) / duration) * 100;
        
        return {
          ...prev,
          stats: {
            ...prev.stats,
            total_duration: duration,
            time_saved_percentage: time_saved_percentage
          }
        };
      }
      return prev;
    });
  };

  useEffect(() => {
    if (jobId) {
      setIsLoading(true);
      setError(null);
      console.log(`Video page loading data for job: ${jobId}`);

      const fetchData = async () => {
        try {
          const response = await fetch(`/api/process-status?jobId=${jobId}`);
          
          if (!response.ok) {
             const errorText = await response.text();
             throw new Error(`Failed to fetch job data (Status: ${response.status}): ${errorText}`);
          }

          const result = await response.json();

          if (result.status === 'complete' && result.data) {
            console.log('Received data for video page:', result.data);
            // *** ADD THIS LOG ***
            console.log('Segments received from API:', JSON.stringify(result.data.segments || [], null, 2)); 
            
            setLessonData({
              summary: result.data.summary || "",
              keyPoints: result.data.keyPoints || [],
              flashcards: result.data.flashcards || [],
              transcript: result.data.transcript || "",
              segments: result.data.segments || [],
              stats: result.data.stats ? {
                total_segments: result.data.stats.total_segments || 0,
                skippable_segments: result.data.stats.skippable_segments || 0,
                total_duration: result.data.stats.total_duration || 0,
                skippable_duration: result.data.stats.skippable_duration || 0,
                skippable_percentage: result.data.stats.skippable_percentage || 0,
                time_saved_percentage: result.data.stats.time_saved_percentage || 0
              } : defaultLessonData.stats
            });

            if (!result.data.originalUrl) {
              console.error("Processing complete but originalUrl is missing in data.");
              setError("Video URL is missing in the processing results.");
            }
            setOriginalVideo({ url: result.data.originalUrl || null, error: null });
            setTurboVideo({ url: result.data.originalUrl || null, error: null }); 

          } else if (result.status === 'processing') {
             setError('Processing is still in progress. Please wait and refresh.');
          } else if (result.status === 'error') {
             setError(`Processing failed: ${result.message}`);
          } else if (result.status === 'not_found') {
             setError('Video processing data not found for this ID.');
          } else {
             setError('Failed to load video data: Invalid status or data missing.');
             console.error("Unexpected result structure:", result);
          }
        } catch (fetchError) {
          console.error('Error fetching video data:', fetchError);
          setError(fetchError instanceof Error ? fetchError.message : 'An unknown error occurred while fetching data.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    } else {
      setError('Job ID is missing in the URL.');
      setIsLoading(false);
    }
  }, [jobId]);

  // --- Add useEffect for pre-calculating times ---
  useEffect(() => {
    if (lessonData.segments && lessonData.segments.length > 0) {
      console.log("Recalculating time map due to segment change...");
      const timeMap: TimeMapPoint[] = [];
      let cumulativeAdjustedTime = 0;

      // Ensure segments are sorted by start time (important!)
      const sortedSegments = [...lessonData.segments].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

      // Start point
      timeMap.push({
        actualTime: 0,
        adjustedTime: 0,
        // Speed of the first segment (or 1 if no segments/invalid speed)
        segmentSpeed: sortedSegments[0]?.playback_speed > 0 ? sortedSegments[0].playback_speed : 1, 
      });

      for (let i = 0; i < sortedSegments.length; i++) {
        const segment = sortedSegments[i];
        // Use nullish coalescing for safety, default to 0
        const segStart = segment.start ?? 0; 
        const segEnd = segment.end ?? 0;
        // Ensure speed is positive, default to 1
        const segSpeed = segment.playback_speed > 0 ? segment.playback_speed : 1; 
        // Ensure duration is non-negative
        const segmentDuration = Math.max(0, segEnd - segStart); 

        // Calculate adjusted duration for this segment
        const adjustedSegmentDuration = segmentDuration / segSpeed;
        cumulativeAdjustedTime += adjustedSegmentDuration;

        // Determine the speed of the *next* segment (or 1 if it's the last)
        const nextSegmentSpeed = sortedSegments[i + 1]?.playback_speed > 0 
            ? sortedSegments[i + 1].playback_speed 
            : 1; 

        // Add a point at the END of this segment
        // Check if the next segment starts exactly where this one ends to avoid duplicate time points
        const nextSegStart = sortedSegments[i + 1]?.start ?? Infinity;
        
        if (segEnd < nextSegStart) { // Only add if there's a gap or it's the last segment
             // Check if this point already exists (e.g., zero-duration segment)
             if (timeMap.length === 0 || timeMap[timeMap.length - 1].actualTime < segEnd) {
                 timeMap.push({
                    actualTime: segEnd,
                    adjustedTime: cumulativeAdjustedTime,
                    // The speed starting *at* segEnd is the speed of the next segment
                    segmentSpeed: nextSegmentSpeed, 
                 });
             } else if (timeMap[timeMap.length - 1].actualTime === segEnd) {
                 // If times are identical (e.g. back-to-back segments), update the speed for the boundary
                 timeMap[timeMap.length - 1].segmentSpeed = nextSegmentSpeed;
             }
        } else {
            // If next segment starts exactly at segEnd, the speed update is handled
            // when processing the next segment's start point implicitly, or
            // if the previous push already added this time point, update its speed.
             if (timeMap.length > 0 && timeMap[timeMap.length - 1].actualTime === segEnd) {
                 timeMap[timeMap.length - 1].segmentSpeed = nextSegmentSpeed;
             }
        }
      }
      console.log("Precalculated Time Map:", JSON.stringify(timeMap, null, 2));
      setPrecalculatedTimes(timeMap);
    } else {
      setPrecalculatedTimes([]); // Reset if no segments
    }
  }, [lessonData.segments]); // Dependency array

  useEffect(() => {
    if (lessonData.segments.length > 0) {
      const total_duration = actualVideoDuration || 
        lessonData.segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0);
      
      const total_segments = lessonData.segments.length;
      const skippable_segments = lessonData.segments.filter(segment => segment.can_skip).length;
      const skippable_duration = lessonData.segments.reduce((sum, segment) => 
        segment.can_skip ? sum + (segment.end - segment.start) : sum, 0);
      const skippable_percentage = total_duration ? (skippable_duration / total_duration) * 100 : 0;
      
      const adjusted_time = lessonData.segments.reduce((sum, segment) => 
        sum + (segment.end - segment.start) / segment.playback_speed, 0);
      const time_saved_percentage = total_duration ? ((total_duration - adjusted_time) / total_duration) * 100 : 0;

      if (
        lessonData.stats.total_segments !== total_segments ||
        lessonData.stats.skippable_segments !== skippable_segments ||
        Math.abs(lessonData.stats.total_duration - total_duration) > 1 ||
        Math.abs(lessonData.stats.skippable_duration - skippable_duration) > 1 ||
        Math.abs(lessonData.stats.skippable_percentage - skippable_percentage) > 0.1 ||
        Math.abs(lessonData.stats.time_saved_percentage - time_saved_percentage) > 0.1
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
  }, [lessonData.segments, actualVideoDuration]);

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
  

  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-6">
        <LoadingSpinner />
        <div className="mt-4 text-lg text-gray-400">Loading video data for Job ID: {jobId}...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-xl text-red-500 mb-4">Error Loading Video Data</div>
        <div className="text-md text-gray-300 mb-6">{error}</div>
        <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Go back to Upload
        </Link>
      </main>
    );
  }

  if (!originalVideo.url && !turboVideo.url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-xl text-gray-400 mb-4">Video URL not found</div>
        <div className="text-sm text-gray-500">The processing completed, but the video link is missing.</div>
         <Link href="/" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Go back to Upload
        </Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto">
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
            
            <div className="rounded-lg overflow-hidden bg-black">
              <VideoPlayer 
                type={activeVideo}
                video={activeVideo === 'original' ? originalVideo : turboVideo}
                onError={handleVideoError}
                segments={lessonData.segments}
                precalculatedTimes={precalculatedTimes} // <-- Pass down the new state
                videoRef={activeVideo === 'original' ? originalVideoRef : turboVideoRef}
                onDurationLoaded={handleVideoDurationLoaded}
              />
            </div>

            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Summary</h2>
              {isLoading ? (
                <LoadingPulse />
              ) : (
                <div className="text-gray-300">
                  {lessonData?.summary || "No summary available"}
                </div>
              )}
            </div>

            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Key Points</h2>
              {isLoading ? (
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

            <div className="bg-zinc-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Analysis</h2>
              {isLoading ? (
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

          <div className="space-y-6">
            <div
              className={`bg-zinc-800 shadow rounded-lg p-6 transition-all duration-300 ${
                isTranscriptExpanded ? "hidden" : "block"
              }`}
            >
              <h2 className="text-xl font-semibold mb-4 text-white">Flashcards</h2>
              {isLoading ? (
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
                {isLoading ? (
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