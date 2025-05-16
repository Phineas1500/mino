"use client";

import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/FileUpload"
import { Roboto_Mono } from "next/font/google"

const robotoMono = Roboto_Mono({
  weight: ['400', '500'],  // include the weights you need
  subsets: ['latin'],
})

export default function HomePage() {
  const router = useRouter();

  const handleFileChange = (file: File) => {
    const videoUrl = URL.createObjectURL(file);
    // store in sessionStorage for retrieval in video page
    sessionStorage.setItem("videoUrl", videoUrl);
    // navigate to video display page
    router.push("/video");
  };

  const handleProcessingComplete = (data: any) => {
    // Store the transcript data in sessionStorage
    sessionStorage.setItem("lessonData", JSON.stringify(data));
    router.push("/video");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-4 md:p-8">
      <div className="flex-1 w-full max-w-6xl flex items-center justify-center gap-2 md:gap-4">
        <div className={`text-2xl md:text-4xl font-medium tracking-tight ${robotoMono.className}`}>min</div>
        <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">(</div>
        <div className="flex-1 max-w-2xl px-4">
          <FileUpload 
            onFileSelect={handleFileChange} 
            onProcessingComplete={handleProcessingComplete}
            accept="video/*" 
          />
        </div>
        <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">)</div>
      </div>
      <div className="w-full text-center text-sm text-muted-foreground mt-8">
        New to minomize? <a href="https://minomize.com/video/84fd0ac5-a7de-41b2-a0ec-25b7fb141278" className="underline hover:text-foreground transition-colors">Check out an example video page.</a>
      </div>
    </main>
  )
}

