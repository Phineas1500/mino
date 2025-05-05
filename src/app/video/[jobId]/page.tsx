"use client"
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Import useRouter
import Link from 'next/link';
import { Roboto_Mono } from "next/font/google";
import { 
  Play, Zap, ChevronLeft, ChevronRight, Copy, Check, Share2, 
  LocateFixed, LocateOff, Eye, EyeOff // <-- Add Eye, EyeOff
} from 'lucide-react'; 

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

interface TimeMapPoint {
  actualTime: number;
  adjustedTime: number;
  segmentSpeed: number; // Speed *starting* at this actualTime
}

interface VideoPlayerProps {
  type: 'original' | 'turbo'
  video: VideoState
  onError: (type: 'original' | 'turbo', error: string) => void
  segments: Segment[] // Keep segments for playbackRate adjustment
  precalculatedTimes: TimeMapPoint[] // <-- Add prop
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
  onDurationLoaded?: (duration: number) => void
  onTimeUpdateActual?: (time: number) => void; // <-- Add this prop
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

const VideoPlayer = ({ 
  type, 
  video, 
  onError,
  segments, 
  precalculatedTimes, 
  videoRef,
  onDurationLoaded,
  onTimeUpdateActual // <-- Destructure the new prop
}: VideoPlayerProps) => {
  useEffect(() => {
    console.log('VideoPlayer received segments prop:', JSON.stringify(segments || [], null, 2));
  }, [segments]); // Log whenever segments prop changes

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedAdjustedTime, setSpeedAdjustedTime] = useState(0)

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

  const calculateSpeedAdjustedTime = (currentActualTime: number): number => {
    if (precalculatedTimes.length === 0) {
        return 0;
    }

    let basePoint: TimeMapPoint | null = null;
    for (let i = 0; i < precalculatedTimes.length; i++) {
        if (precalculatedTimes[i].actualTime <= currentActualTime) {
            basePoint = precalculatedTimes[i];
        } else {
            break; 
        }
    }

    if (!basePoint) {
       console.warn(`Could not find base point for currentActualTime: ${currentActualTime}. Using first segment speed.`);
       const firstSpeed = precalculatedTimes[0]?.segmentSpeed || 1;
       return currentActualTime / firstSpeed;
    }

    const timeSinceBasePoint = currentActualTime - basePoint.actualTime;
    const currentSpeed = basePoint.segmentSpeed > 0 ? basePoint.segmentSpeed : 1;
    const adjustedTimeSinceBasePoint = timeSinceBasePoint / currentSpeed;
    const finalAdjustedTime = basePoint.adjustedTime + adjustedTimeSinceBasePoint;

    return finalAdjustedTime;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const currentActualTime = video.currentTime;
    setCurrentTime(currentActualTime);

    if (onTimeUpdateActual) {
      onTimeUpdateActual(currentActualTime);
    }

    if (type === 'turbo') {
        const currentSegment = segments.find(
            seg => currentActualTime >= (seg.start ?? 0) && currentActualTime < (seg.end ?? 0) 
        );
        
        let targetSpeed = 1;
        if (currentSegment && currentSegment.playback_speed > 0) {
            targetSpeed = currentSegment.playback_speed;
        }
        
        if (video.playbackRate !== targetSpeed) {
            video.playbackRate = targetSpeed;
        }
        const calculatedAdjustedTime = calculateSpeedAdjustedTime(currentActualTime);
        
        const clampedAdjustedTime = Math.min(calculatedAdjustedTime, speedAdjustedDuration);
        setSpeedAdjustedTime(clampedAdjustedTime);
    } else {
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
          <span className="text-gray-400">Sped up: </span>
          <span className="text-white">{formatTime(speedAdjustedTime)}</span>
          <span className="text-gray-400"> / </span>
          <span className="text-white">{formatTime(speedAdjustedDuration)}</span>
        </div>
      )}
    </div>
  ) : null
}

export default function VideoJobPage() { 
  const params = useParams(); 
  const jobId = params.jobId as string; 
  const router = useRouter(); // Use router if needed, or window.location for URL

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<LessonData>(defaultLessonData);
  const [originalVideo, setOriginalVideo] = useState<VideoState>({ url: null, error: null });
  const [turboVideo, setTurboVideo] = useState<VideoState>({ url: null, error: null });

  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const turboVideoRef = useRef<HTMLVideoElement>(null);
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [activeVideo, setActiveVideo] = useState<'original' | 'turbo'>('turbo');
  const [actualVideoDuration, setActualVideoDuration] = useState<number | null>(null);
  const [precalculatedTimes, setPrecalculatedTimes] = useState<TimeMapPoint[]>([]); 

  const [currentVideoTime, setCurrentVideoTime] = useState(0); // Track actual video time
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]); // Array to hold refs for each segment div
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for detecting end of user scroll
  const programmaticScroll = useRef(false); 
  const [isCopied, setIsCopied] = useState(false); // State for copy feedback

  const handleVideoTimeUpdate = useCallback((time: number) => {
    setCurrentVideoTime(time);
  }, []);

  useEffect(() => {
    const index = lessonData.segments.findIndex(
      seg => currentVideoTime >= (seg.start ?? 0) && currentVideoTime < (seg.end ?? 0)
    );
    let newIndex = -1;
    if (index !== -1) {
      newIndex = index;
    } else if (lessonData.segments.length > 0 && currentVideoTime < (lessonData.segments[0].start ?? 0)) {
       newIndex = 0;
    } else if (lessonData.segments.length > 0 && currentVideoTime >= (lessonData.segments[lessonData.segments.length - 1].start ?? 0)) {
       newIndex = lessonData.segments.length - 1;
    }

    if (newIndex !== activeSegmentIndex) {
      setActiveSegmentIndex(newIndex);
    }
  }, [currentVideoTime, lessonData.segments, activeSegmentIndex]);

  useEffect(() => {
    if (isAutoScrollEnabled && activeSegmentIndex !== -1) {
      const activeSegmentElement = segmentRefs.current[activeSegmentIndex];
      if (activeSegmentElement && transcriptContainerRef.current) {
        const containerRect = transcriptContainerRef.current.getBoundingClientRect();
        const elementRect = activeSegmentElement.getBoundingClientRect();

        if (elementRect.top < containerRect.top + 50 || elementRect.bottom > containerRect.bottom - 50) {
            programmaticScroll.current = true; 
            
            activeSegmentElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest', 
            });
        }
      }
    }
  }, [activeSegmentIndex, isAutoScrollEnabled]); 

  const handleTranscriptScroll = () => {
    if (programmaticScroll.current) {
      programmaticScroll.current = false; 
      return; 
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
    }, 150); 
  };

  const toggleAutoScroll = () => {
    const newState = !isAutoScrollEnabled;
    console.log(`[toggleAutoScroll] Setting auto-scroll to: ${newState}`);
    setIsAutoScrollEnabled(newState); // Update the state
    
    if (newState && activeSegmentIndex !== -1) {
      const activeSegmentElement = segmentRefs.current[activeSegmentIndex];
      if (activeSegmentElement) {
          console.log(`[toggleAutoScroll] Scrolling segment ${activeSegmentIndex} into view.`);
          programmaticScroll.current = true; 
          activeSegmentElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest' 
          });
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (lessonData.segments && lessonData.segments.length > 0) {
      console.log("Recalculating time map due to segment change...");
      const timeMap: TimeMapPoint[] = [];
      let cumulativeAdjustedTime = 0;

      const sortedSegments = [...lessonData.segments].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

      timeMap.push({
        actualTime: 0,
        adjustedTime: 0,
        segmentSpeed: sortedSegments[0]?.playback_speed > 0 ? sortedSegments[0].playback_speed : 1, 
      });

      for (let i = 0; i < sortedSegments.length; i++) {
        const segment = sortedSegments[i];
        const segStart = segment.start ?? 0; 
        const segEnd = segment.end ?? 0;
        const segSpeed = segment.playback_speed > 0 ? segment.playback_speed : 1; 
        const segmentDuration = Math.max(0, segEnd - segStart); 

        const adjustedSegmentDuration = segmentDuration / segSpeed;
        cumulativeAdjustedTime += adjustedSegmentDuration;

        const nextSegmentSpeed = sortedSegments[i + 1]?.playback_speed > 0 
            ? sortedSegments[i + 1].playback_speed 
            : 1; 

        const nextSegStart = sortedSegments[i + 1]?.start ?? Infinity;
        
        if (segEnd < nextSegStart) {
             if (timeMap.length === 0 || timeMap[timeMap.length - 1].actualTime < segEnd) {
                 timeMap.push({
                    actualTime: segEnd,
                    adjustedTime: cumulativeAdjustedTime,
                    segmentSpeed: nextSegmentSpeed, 
                 });
             } else if (timeMap[timeMap.length - 1].actualTime === segEnd) {
                 timeMap[timeMap.length - 1].segmentSpeed = nextSegmentSpeed;
             }
        } else {
             if (timeMap.length > 0 && timeMap[timeMap.length - 1].actualTime === segEnd) {
                 timeMap[timeMap.length - 1].segmentSpeed = nextSegmentSpeed;
             }
        }
      }
      console.log("Precalculated Time Map:", JSON.stringify(timeMap, null, 2));
      setPrecalculatedTimes(timeMap);
    } else {
      setPrecalculatedTimes([]);
    }
  }, [lessonData.segments]);

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
  
  // --- Add function to handle copying the URL ---
  const handleShare = async () => {
    const urlToCopy = window.location.href; // Get current page URL
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setIsCopied(true);
      console.log('Page URL copied to clipboard:', urlToCopy);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Optionally show an error message to the user
    }
  };
  // --- End Add ---

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
    <main className="min-h-screen flex flex-col p-2 md:p-4"> 
      {/* Header */}
      <Link href="/">
        <div className="w-full flex items-center justify-center gap-2 md:gap-4 mb-4 cursor-pointer">
          <div className={`text-xl md:text-2xl font-medium tracking-tight ${robotoMono.className}`}>min</div>
          <div className="flex items-center gap-0 text-2xl md:text-4xl font-light tracking-tighter text-muted-foreground">
            <span>(</span>
            <ChevronLeft className="w-8 h-8 md:w-10 md:h-10 opacity-50 relative top-[3px]" />
            <span>)</span>
          </div>
        </div>
      </Link>

      {/* --- Main Content Area: Flex row on large screens, column on smaller --- */}
      <div className="flex flex-col lg:flex-row flex-grow gap-4 w-full max-w-full mx-auto"> 

        {/* --- Left Column (Video + Info Below) --- */}
        {/* Use flex-basis for percentage-like width, min-w-0 prevents overflow issues */}
        <div className="flex flex-col lg:flex-[7] min-w-0 space-y-4"> 
          {/* Video Player Area */}
          <div className="sticky top-2 md:top-4 z-10"> {/* Make video player sticky */}
            <div className="flex justify-between items-center mb-2 px-1"> {/* Less margin */}
              {/* Title can be removed or kept minimal */}
              {/* <h1 className="text-xl font-bold">Video Lesson</h1> */}
              <div className="flex gap-2 ml-auto"> {/* Buttons pushed to the right */}
                <button
                  onClick={handleShare}
                  title="Copy link to clipboard"
                  className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs sm:text-sm transition-colors duration-200 ${
                    isCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                  }`}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  {isCopied ? 'Copied!' : 'Share'}
                </button>
                <button
                  onClick={() => setActiveVideo('original')}
                  title="Play Original Video"
                  className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs sm:text-sm transition-colors duration-200 ${
                    activeVideo === 'original' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  Original
                </button>
                <button
                  onClick={() => setActiveVideo('turbo')}
                  title="Play Turbo Video"
                  className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs sm:text-sm transition-colors duration-200 ${
                    activeVideo === 'turbo' ? 'bg-purple-600 text-white' : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${activeVideo === 'turbo' ? 'animate-pulse' : ''}`} />
                  Turbo
                </button>
              </div>
            </div>
            
            <div className="rounded-lg overflow-hidden bg-black border border-zinc-700 shadow-lg"> {/* Add border/shadow */}
              <VideoPlayer 
                type={activeVideo}
                video={activeVideo === 'original' ? originalVideo : turboVideo}
                onError={handleVideoError}
                segments={lessonData.segments}
                precalculatedTimes={precalculatedTimes} 
                videoRef={activeVideo === 'original' ? originalVideoRef : turboVideoRef}
                onDurationLoaded={handleVideoDurationLoaded}
                onTimeUpdateActual={handleVideoTimeUpdate} 
              />
            </div>
          </div>

          {/* Info Below Video (Summary, Key Points, Analysis) */}
          <div className="space-y-4 pt-4"> {/* Add padding top */}
            <div className="bg-zinc-800 shadow rounded-lg p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-3 text-white">Summary</h2>
              {isLoading ? <LoadingPulse /> : <p className="text-sm text-gray-300">{lessonData.summary}</p>}
            </div>

            <div className="bg-zinc-800 shadow rounded-lg p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-3 text-white">Key Points</h2>
              {isLoading ? <LoadingPulse /> : (lessonData?.keyPoints && lessonData.keyPoints.length > 0) ? (
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-1.5">
                  {lessonData.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-400">No key points generated.</p>}
            </div>

            <div className="bg-zinc-800 shadow rounded-lg p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-3 text-white">Analysis</h2>
              {isLoading ? <LoadingPulse /> : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Total Duration</div>
                    <div className="text-white font-medium">{formatTimestamp(lessonData.stats.total_duration)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Skippable Segments</div>
                    <div className="text-white font-medium">{lessonData.stats.skippable_segments} / {lessonData.stats.total_segments}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Time Saved</div>
                    <div className="text-white font-medium">{lessonData.stats.time_saved_percentage.toFixed(1)}%</div>
                  </div>
                   <div>
                    <div className="text-gray-400">Skippable Content</div>
                    <div className="text-white font-medium">{lessonData.stats.skippable_percentage.toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Right Column (Transcript + Flashcards) --- */}
        {/* Use flex-basis, min-w-0, and flex column */}
        <div className="flex flex-col lg:flex-[3] min-w-0 space-y-4 lg:max-h-[calc(100vh-80px)]"> {/* Limit height on large screens */}
          
          {/* Transcript Card - Always Expanded */}
          <div className="bg-zinc-800 shadow rounded-lg flex flex-col flex-grow overflow-hidden"> {/* flex-grow allows it to take space */}
            <div className="p-4 border-b border-zinc-700 flex justify-between items-center flex-shrink-0"> {/* Header */}
              <h2 className="text-lg font-semibold text-white">Transcript</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAutoScroll} 
                  title={isAutoScrollEnabled ? "Disable Auto-Scroll" : "Enable Auto-Scroll"}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-zinc-700"
                >
                  {isAutoScrollEnabled ? <LocateFixed className="w-4 h-4 text-blue-400" /> : <LocateOff className="w-4 h-4" />}
                </button>
                {/* Removed Expand/Collapse Button */}
              </div>
            </div>
            {/* Transcript Content - Scrollable */}
            <div 
              ref={transcriptContainerRef} 
              onScroll={handleTranscriptScroll}
              className="p-4 space-y-3 overflow-y-auto flex-grow" // flex-grow + overflow-y-auto
            >
              {isLoading ? (
                <LoadingPulse />
              ) : lessonData.segments && lessonData.segments.length > 0 ? (
                lessonData.segments.map((segment, index) => (
                  <div 
                    key={index} 
                    ref={el => { segmentRefs.current[index] = el; }} // Assign ref
                    onClick={() => handleTimestampClick(segment.start ?? 0)}
                    className={`p-2 rounded-md cursor-pointer transition-colors duration-200 ${
                      activeSegmentIndex === index ? 'bg-blue-900/50' : 'hover:bg-zinc-700/50'
                    }`}
                  >
                    <span className="text-xs font-mono text-blue-400 mr-2">
                      {formatTimestamp(segment.start ?? 0)}
                    </span>
                    <span className={`text-sm ${segment.can_skip ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {segment.text}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No transcript data available.</p>
              )}
            </div>
          </div>

          {/* Flashcards Card - Always Visible Below Transcript */}
          <div className="bg-zinc-800 shadow rounded-lg p-4 flex-shrink-0"> {/* flex-shrink-0 prevents it from shrinking */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-white">Flashcards</h2>
              {lessonData.flashcards && lessonData.flashcards.length > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={prevFlashcard} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-zinc-700"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-xs text-gray-400">{currentFlashcard + 1} / {lessonData.flashcards.length}</span>
                  <button onClick={nextFlashcard} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-zinc-700"><ChevronRight className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            {isLoading ? (
              <LoadingPulse />
            ) : lessonData.flashcards && lessonData.flashcards.length > 0 ? (
              <div 
                // --- Remove onClick from the main div ---
                className="bg-zinc-700 p-4 rounded-lg min-h-[100px] relative" // Add relative positioning
              >
                <p className="text-sm font-medium text-white mb-2 pr-10"> {/* Add padding-right for button space */}
                  {lessonData.flashcards[currentFlashcard].question}
                </p>
                
                {/* --- Add Show/Hide Answer Button --- */}
                <button 
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white rounded hover:bg-zinc-600 transition-colors"
                  title={showAnswer ? "Hide Answer" : "Show Answer"}
                >
                  {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {/* --- End Button --- */}

                {showAnswer && (
                  <p className="text-sm text-gray-300 border-t border-zinc-600 pt-2 mt-2">
                    {lessonData.flashcards[currentFlashcard].answer}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No flashcards generated.</p>
            )}
          </div>

        </div> 
      </div> 
    </main>
  )
}