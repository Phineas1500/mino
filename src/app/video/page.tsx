"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Roboto_Mono } from "next/font/google";

const robotoMono = Roboto_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
});

export default function VideoPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Sample data - in a real app, this would come from your backend
  const sampleData = {
    summary: "This video covers the fundamental concepts of React hooks, including useState and useEffect. It demonstrates how these hooks can be used to manage state and side effects in functional components.",
    keyPoints: [
      "useState is used for managing component state",
      "useEffect handles side effects and lifecycle events",
      "Hooks can only be used in functional components",
      "Multiple state variables can be managed independently"
    ],
    flashcards: [
      {
        question: "What is useState used for?",
        answer: "useState is a Hook that lets you add state to functional components"
      },
      {
        question: "When does useEffect run?",
        answer: "useEffect runs after every render, but can be configured to run only when specific dependencies change"
      },
      {
        question: "Can hooks be used in class components?",
        answer: "No, hooks can only be used in functional components"
      }
    ],
    transcript: `
      In today's video, we'll be diving deep into React hooks.
      First, let's talk about useState. useState is one of the most fundamental hooks...
      Next, we'll look at useEffect. This hook is crucial for handling side effects...
      Finally, we'll see how these hooks work together in a real application...
    `
  };

  useEffect(() => {
    const storedUrl = sessionStorage.getItem("videoUrl");
    if (storedUrl) {
      setVideoUrl(storedUrl);
    }
  }, []);

  const nextFlashcard = () => {
    setCurrentFlashcard((prev) => 
      prev === sampleData.flashcards.length - 1 ? 0 : prev + 1
    );
    setShowAnswer(false);
  };

  const prevFlashcard = () => {
    setCurrentFlashcard((prev) => 
      prev === 0 ? sampleData.flashcards.length - 1 : prev - 1
    );
    setShowAnswer(false);
  };

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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <h1 className="text-3xl font-bold">Video Lesson</h1>
            
            {/* Video Player */}
            <div className="rounded-lg overflow-hidden bg-black">
              <video 
                src={videoUrl} 
                controls 
                className="w-full aspect-video"
              />
            </div>

            {/* Flashcard Section */}
            <div className="bg-gray-800 shadow rounded-lg relative">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">Flashcards</h2>
                <div className="flex items-center justify-between">
                  <button 
                    onClick={prevFlashcard}
                    className="p-2 hover:bg-gray-700 rounded-full"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  
                  <div className="text-center flex-1 mx-4">
                    <div 
                      className="cursor-pointer p-4 min-h-32 text-white"
                      onClick={() => setShowAnswer(!showAnswer)}
                    >
                      {showAnswer 
                        ? sampleData.flashcards[currentFlashcard].answer
                        : sampleData.flashcards[currentFlashcard].question}
                    </div>
                    <div className="text-sm text-gray-400">
                      Click to {showAnswer ? 'show question' : 'reveal answer'}
                    </div>
                  </div>

                  <button 
                    onClick={nextFlashcard}
                    className="p-2 hover:bg-gray-700 rounded-full"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-gray-800 shadow rounded-lg">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">Transcript</h2>
                <div className="whitespace-pre-line text-gray-300">
                  {sampleData.transcript}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-gray-800 shadow rounded-lg">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">Summary</h2>
                <p className="text-gray-300">{sampleData.summary}</p>
              </div>
            </div>

            {/* Key Points */}
            <div className="bg-gray-800 shadow rounded-lg">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">Key Points</h2>
                <ul className="list-disc pl-4 space-y-2">
                  {sampleData.keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-300">{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}