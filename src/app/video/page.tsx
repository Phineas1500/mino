"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Roboto_Mono } from "next/font/google";

interface Segment {
  start: number;
  end: number;
  text: string;
}

// interface Flashcard {
//   question: string;
//   answer: string;
// }

interface LessonData {
  // summary: string;
  // keyPoints: string[];
  // flashcards: Flashcard[];
  transcript: string;
  // segments: Segment[];
}

const robotoMono = Roboto_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
});

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

const LoadingPulse = () => (
  <div className="space-y-3">
    <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
    <div className="h-4 bg-gray-700 rounded animate-pulse w-5/6"></div>
    <div className="h-4 bg-gray-700 rounded animate-pulse w-4/6"></div>
  </div>
);

export default function VideoPage() {
  const [videoUrl, setVideoUrl] = useState("");
  // const [currentFlashcard, setCurrentFlashcard] = useState(0);
  // const [showAnswer, setShowAnswer] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lessonData, setLessonData] = useState<LessonData>({
    // summary: "",
    // keyPoints: [],
    // flashcards: [{
    //   question: "Loading...",
    //   answer: "Loading..."
    // }],
    transcript: "",
    // segments: []
  });

  useEffect(() => {
    const storedUrl = sessionStorage.getItem("videoUrl");
    const storedLessonData = sessionStorage.getItem("lessonData");
    
    if (storedUrl) {
      setVideoUrl(storedUrl);
    }
    
    if (storedLessonData) {
      try {
        const parsedData = JSON.parse(storedLessonData);
        setLessonData(parsedData);
      } catch (error) {
        console.error('Error parsing lesson data:', error);
      }
    }
  }, []);

  // New function to handle incoming transcript data
  const handleTranscriptUpdate = async (data: any) => {
    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error('Failed to process transcript');
      
      const result = await response.json();
      if (result.success) {
        setLessonData(result.data);
      }
    } catch (error) {
      console.error('Error updating transcript:', error);
    }
  };

  // Update the test connection function
  const testBackendConnection = async () => {
    try {
      setIsProcessing(true);
      setConnectionStatus("Testing connection...");
      const response = await fetch('http://localhost:3001/api/transcript/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) throw new Error('Failed to connect to backend');
      
      const result = await response.json();
      if (result.success) {
        setConnectionStatus("✅ Backend connected successfully!");
        setLessonData(result.data);
      } else {
        setConnectionStatus("❌ Backend connection failed: " + result.error);
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setConnectionStatus("❌ Backend connection failed: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // const nextFlashcard = () => {
  //   if (!lessonData.flashcards.length) return;
  //   setCurrentFlashcard((prev) => 
  //     prev === lessonData.flashcards.length - 1 ? 0 : prev + 1
  //   );
  //   setShowAnswer(false);
  // };

  // const prevFlashcard = () => {
  //   if (!lessonData.flashcards.length) return;
  //   setCurrentFlashcard((prev) => 
  //     prev === 0 ? lessonData.flashcards.length - 1 : prev - 1
  //   );
  //   setShowAnswer(false);
  // };

  if (!videoUrl) {
    return <div className="p-6">No video to display.</div>;
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto">
        {/* Branding Header matching HomePage */}
        <div className="w-full flex items-center justify-center gap-2 md:gap-4 mb-8">
          <div className={`text-2xl md:text-4xl font-medium tracking-tight ${robotoMono.className}`}>min</div>
          <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">(</div>
          <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">)</div>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {/* Main Content */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Video Lesson</h1>
              <button
                onClick={testBackendConnection}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Backend Connection
              </button>
            </div>
            {connectionStatus && (
              <div className={`p-4 rounded-lg ${connectionStatus.includes("✅") ? "bg-green-800" : "bg-red-800"} text-white`}>
                {connectionStatus}
              </div>
            )}
            
            {/* Video Player */}
            <div className="rounded-lg overflow-hidden bg-black">
              <video 
                src={videoUrl} 
                controls 
                className="w-full aspect-video"
              />
            </div>

            {/* Transcript */}
            <div className="bg-gray-800 shadow rounded-lg">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">Transcript</h2>
                {isProcessing ? (
                  <LoadingPulse />
                ) : (
                  <div className="text-gray-300">
                    {lessonData.transcript || "No transcript available"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}