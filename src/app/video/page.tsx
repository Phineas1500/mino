"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Roboto_Mono } from "next/font/google";

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface Flashcard {
  question: string;
  answer: string;
}

interface LessonData {
  summary: string;
  keyPoints: string[];
  flashcards: Flashcard[];
  transcript: string;
  segments: Segment[];
}

// Sample test data
const sampleLessonData: LessonData = {
  summary: "The lecture on artificial intelligence covers the fundamentals of machine learning, emphasizing supervised and unsupervised learning. Additionally, it delves into key concepts such as neural networks, deep learning, and their practical applications. The ethical considerations surrounding AI and its societal impact are also explored.",
  keyPoints: [
    "The lecture focuses on the fundamentals of machine learning, particularly supervised and unsupervised learning.",
    "Key concepts discussed include neural networks, deep learning, and their real-world applications.",
    "Ethical implications of AI and its effects on society are examined during the lecture.",
    "The importance of understanding neural networks and deep learning in the context of artificial intelligence is highlighted.",
    "The lecture underscores the significance of considering the societal impact of AI developments."
  ],
  flashcards: [
    {
      question: "What are the main types of machine learning discussed in the lecture?",
      answer: "The main types discussed are supervised and unsupervised learning."
    },
    {
      question: "What ethical considerations are explored in relation to artificial intelligence?",
      answer: "The lecture explores the ethical implications of AI and its societal impact."
    },
    {
      question: "Why is it important to understand neural networks and deep learning in the context of artificial intelligence?",
      answer: "Understanding neural networks and deep learning is crucial for leveraging AI effectively in various applications."
    }
  ],
  transcript: "This is a test lecture about artificial intelligence. We discuss the fundamentals of machine learning, including supervised and unsupervised learning. The lecture covers basic concepts like neural networks, deep learning, and their applications in real-world scenarios. We also explore the ethical implications of AI and its impact on society.",
  segments: []
};

const defaultLessonData: LessonData = {
  summary: "",
  keyPoints: [],
  flashcards: [],
  transcript: "",
  segments: []
};

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
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lessonData, setLessonData] = useState<LessonData>(sampleLessonData);

  useEffect(() => {
    const storedUrl = sessionStorage.getItem("videoUrl");
    const storedLessonData = sessionStorage.getItem("lessonData");
    
    if (storedUrl) {
      setVideoUrl(storedUrl);
    } else {
      setVideoUrl("https://example.com/sample-video.mp4"); // Set sample video URL if none stored
    }
    
    if (storedLessonData) {
      try {
        const parsedData = JSON.parse(storedLessonData);
        setLessonData(parsedData);
      } catch (error) {
        console.error('Error parsing lesson data:', error);
        setLessonData(sampleLessonData); // Fallback to sample data if parsing fails
      }
    }
  }, []);

  // Updated function to handle incoming transcript data
  const handleTranscriptUpdate = async (data: any) => {
    try {
      setIsProcessing(true);
      
      // If we already have processed data in the response
      if (data.summary && data.keyPoints && data.flashcards) {
        const processedData: LessonData = {
          summary: data.summary,
          keyPoints: data.keyPoints,
          flashcards: data.flashcards,
          transcript: data.transcript,
          segments: data.segments || []
        };
        sessionStorage.setItem("lessonData", JSON.stringify(processedData));
        setLessonData(processedData);
        return;
      }

      // If we need to process the transcript
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: data.transcript })
      });
      
      if (!response.ok) throw new Error('Failed to process transcript');
      
      const result = await response.json();
      if (result.success && result.data) {
        const processedData: LessonData = {
          summary: result.data.summary || "",
          keyPoints: result.data.keyPoints || [],
          flashcards: result.data.flashcards || [],
          transcript: result.data.transcript || data.transcript || "",
          segments: result.data.segments || data.segments || []
        };
        
        sessionStorage.setItem("lessonData", JSON.stringify(processedData));
        setLessonData(processedData);
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      console.error('Error updating transcript:', error);
      // Set default data on error
      const errorData: LessonData = {
        summary: "Error processing transcript",
        keyPoints: ["Error processing key points"],
        flashcards: [{
          question: "Error processing flashcards",
          answer: "Please try again"
        }],
        transcript: data.transcript || "",
        segments: data.segments || []
      };
      setLessonData(errorData);
    } finally {
      setIsProcessing(false);
    }
  };

  const nextFlashcard = () => {
    if (!lessonData.flashcards.length) return;
    setCurrentFlashcard((prev) => 
      prev === lessonData.flashcards.length - 1 ? 0 : prev + 1
    );
    setShowAnswer(false);
  };

  const prevFlashcard = () => {
    if (!lessonData.flashcards.length) return;
    setCurrentFlashcard((prev) => 
      prev === 0 ? lessonData.flashcards.length - 1 : prev - 1
    );
    setShowAnswer(false);
  };

  if (!videoUrl) {
    return <div className="p-6">No video to display.</div>;
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
                src={videoUrl} 
                controls 
                className="w-full aspect-video"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Summary</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : (
                <div className="text-gray-300">
                  {lessonData?.summary}
                </div>
              )}
            </div>

            {/* Key Points */}
            <div className="bg-gray-800 shadow rounded-lg p-6">
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
            <div className="bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Flashcards</h2>
              {isProcessing ? (
                <LoadingPulse />
              ) : (lessonData?.flashcards && lessonData.flashcards.length > 0) ? (
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
            <div className="bg-gray-800 shadow rounded-lg">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">Transcript</h2>
                {isProcessing ? (
                  <LoadingPulse />
                ) : lessonData?.transcript ? (
                  <div className="text-gray-300 whitespace-pre-wrap">
                    {lessonData.transcript}
                  </div>
                ) : (
                  <div className="text-gray-400">No transcript available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}