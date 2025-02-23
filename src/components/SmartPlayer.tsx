// 'use client'

// import { useEffect, useRef, useState } from "react"
// import { Play, Pause, RotateCcw, FastForward, Timer } from "lucide-react"

// interface Segment {
//   start: number
//   end: number
//   text: string
//   speed: number
//   importance_score: number
//   reason: string
// }

// interface PlaybackStats {
//   original_duration: number
//   optimized_duration: number
//   time_saved: number
//   time_saved_percentage: number
// }

// interface SmartPlayerProps {
//   videoUrl: string
//   segments: Segment[]
//   playbackStats: PlaybackStats
// }

// export function SmartPlayer({ videoUrl, segments, playbackStats }: SmartPlayerProps) {
//   const videoRef = useRef<HTMLVideoElement>(null)
//   const [isPlaying, setIsPlaying] = useState(false)
//   const [currentTime, setCurrentTime] = useState(0)
//   const [currentSegment, setCurrentSegment] = useState<Segment | null>(null)
//   const [isOptimized, setIsOptimized] = useState(true)

//   // Update current time and segment
//   useEffect(() => {
//     const video = videoRef.current
//     if (!video) return

//     const handleTimeUpdate = () => {
//       setCurrentTime(video.currentTime)
      
//       // Find current segment
//       const segment = segments.find(
//         seg => video.currentTime >= seg.start && video.currentTime < seg.end
//       )
      
//       if (segment && isOptimized) {
//         if (video.playbackRate !== segment.speed) {
//           video.playbackRate = segment.speed
//         }
//         setCurrentSegment(segment)
//       } else if (!isOptimized && video.playbackRate !== 1) {
//         video.playbackRate = 1
//         setCurrentSegment(null)
//       }
//     }

//     video.addEventListener('timeupdate', handleTimeUpdate)
//     return () => video.removeEventListener('timeupdate', handleTimeUpdate)
//   }, [segments, isOptimized])

//   const togglePlay = () => {
//     if (videoRef.current) {
//       if (isPlaying) {
//         videoRef.current.pause()
//       } else {
//         videoRef.current.play()
//       }
//       setIsPlaying(!isPlaying)
//     }
//   }

//   const restartVideo = () => {
//     if (videoRef.current) {
//       videoRef.current.currentTime = 0
//       setCurrentTime(0)
//     }
//   }

//   const toggleOptimization = () => {
//     setIsOptimized(!isOptimized)
//     if (videoRef.current) {
//       videoRef.current.playbackRate = 1
//     }
//   }

//   const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60)
//     const secs = Math.floor(seconds % 60)
//     return `${mins}:${secs.toString().padStart(2, '0')}`
//   }

//   return (
//     <div className="w-full space-y-4">
//       {/* Video Player */}
//       <div className="relative rounded-lg overflow-hidden bg-black">
//         <video
//           ref={videoRef}
//           src={videoUrl}
//           className="w-full aspect-video"
//           onPlay={() => setIsPlaying(true)}
//           onPause={() => setIsPlaying(false)}
//         />
        
//         {/* Controls Overlay */}
//         <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
//           <div className="flex items-center gap-4">
//             <button
//               onClick={togglePlay}
//               className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
//             >
//               {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
//             </button>
            
//             <button
//               onClick={restartVideo}
//               className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
//             >
//               <RotateCcw className="w-5 h-5" />
//             </button>

//             <button
//               onClick={toggleOptimization}
//               className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition ${
//                 isOptimized ? 'bg-blue-500/80 hover:bg-blue-600/80' : 'bg-white/10 hover:bg-white/20'
//               }`}
//             >
//               <FastForward className="w-4 h-4" />
//               <span className="text-sm">Smart Speed</span>
//             </button>

//             <div className="flex items-center gap-2 text-sm">
//               <Timer className="w-4 h-4" />
//               <span>
//                 {formatTime(currentTime)} / {formatTime(videoRef.current?.duration || 0)}
//               </span>
//             </div>

//             {isOptimized && playbackStats && (
//               <div className="ml-auto text-sm text-green-400">
//                 Saving {Math.round(playbackStats.time_saved_percentage)}% time
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Current Segment Info */}
//       {isOptimized && currentSegment && (
//         <div className="p-4 bg-zinc-800 rounded-lg space-y-2">
//           <div className="flex items-center justify-between">
//             <div className="text-sm font-medium">
//               Current Speed: {currentSegment.speed}x
//             </div>
//             <div className="text-sm text-blue-400">
//               Importance: {currentSegment.importance_score}/10
//             </div>
//           </div>
//           <p className="text-sm text-gray-400">{currentSegment.reason}</p>
//           <p className="text-sm">{currentSegment.text}</p>
//         </div>
//       )}

//       {/* Segments Timeline */}
//       <div className="h-8 w-full bg-zinc-800 rounded-lg overflow-hidden flex">
//         {segments.map((segment, index) => {
//           const duration = videoRef.current?.duration || 0
//           const width = duration ? ((segment.end - segment.start) / duration) * 100 : 0
//           const isActive = currentTime >= segment.start && currentTime < segment.end
          
//           return (
//             <div
//               key={index}
//               style={{ width: `${width}%` }}
//               className={`h-full relative group ${
//                 isActive ? 'bg-blue-500' : 'bg-zinc-700'
//               }`}
//               onClick={() => {
//                 if (videoRef.current) {
//                   videoRef.current.currentTime = segment.start
//                 }
//               }}
//             >
//               <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded text-xs whitespace-nowrap">
//                 {segment.speed}x speed
//               </div>
//               <div
//                 className="h-full bg-green-500 opacity-30"
//                 style={{
//                   width: '100%',
//                   transform: `scaleX(${segment.speed / 2})`,
//                   transformOrigin: 'left'
//                 }}
//               />
//             </div>
//           )
//         })}
//       </div>
//     </div>
//   )
// } 