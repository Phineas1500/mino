"use client";

import React, { useState } from "react";
import { Roboto_Mono } from "next/font/google";

const robotoMono = Roboto_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
});

// Use localhost for development, Pi's IP for production
const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://100.70.34.122:3001'
  : 'http://100.70.34.122:3001';

interface LessonData {
  summary: string;
  keyPoints: string[];
  flashcards: { question: string; answer: string }[];
  transcript: string;
  segments: any[];
}

export default function TestPage() {
  const [processed, setProcessed] = useState<LessonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const testTranscript = `This is a test lecture about artificial intelligence. 
    We discuss the fundamentals of machine learning, including supervised and unsupervised learning. 
    The lecture covers basic concepts like neural networks, deep learning, and their applications in real-world scenarios. 
    We also explore the ethical implications of AI and its impact on society.`;

  const testModalProcessing = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Starting test...');
      console.log('Using API URL:', API_URL);
      const response = await fetch(`${API_URL}/api/transcript/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: testTranscript })
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to process transcript');
      }

      const result = await response.json();
      console.log('Modal Processing Result:', result);

      if (result.success && result.data) {
        // Store the processed data in session storage (like the main app would)
        sessionStorage.setItem("lessonData", JSON.stringify(result.data));
        setProcessed(result.data);
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      console.error('Error in test:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        {/* Branding Header */}
        <div className="w-full flex items-center justify-center gap-2 md:gap-4 mb-8">
          <div className={`text-2xl md:text-4xl font-medium tracking-tight ${robotoMono.className}`}>min</div>
          <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">(</div>
          <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">)</div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold mb-4">Test Transcript Processing</h1>
            
            <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
              <h2 className="font-semibold mb-2 text-white">Test Transcript:</h2>
              <pre className="whitespace-pre-wrap text-sm text-gray-300">{testTranscript}</pre>
            </div>

            <button 
              onClick={testModalProcessing}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Test Modal Processing'}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-900/50 text-red-200 rounded-lg">
              Error: {error}
            </div>
          )}

          {processed && (
            <div className="space-y-6">
              <div className="p-6 bg-gray-800 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-white">Summary</h2>
                <p className="text-gray-300">{processed.summary}</p>
              </div>

              <div className="p-6 bg-gray-800 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-white">Key Points</h2>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  {processed.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-gray-800 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-white">Flashcards</h2>
                <div className="space-y-4">
                  {processed.flashcards.map((card, index) => (
                    <div key={index} className="p-4 bg-gray-700 rounded-lg">
                      <p className="font-medium text-white">Q: {card.question}</p>
                      <p className="mt-2 text-gray-300">A: {card.answer}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-gray-800 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-white">Transcript</h2>
                <p className="text-gray-300 whitespace-pre-wrap">{processed.transcript}</p>
              </div>

              <div className="p-6 bg-gray-800 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-white">Segments</h2>
                <pre className="text-sm text-gray-300 bg-gray-700 p-4 rounded-lg overflow-auto">
                  {JSON.stringify(processed.segments, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 