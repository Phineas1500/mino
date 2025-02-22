import { FileUpload } from "@/components/FileUpload"
import { Roboto_Mono } from "next/font/google"

const robotoMono = Roboto_Mono({
  weight: ['400', '500'],  // include the weights you need
  subsets: ['latin'],
})

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl flex items-center justify-center gap-2 md:gap-4">
      <div className={`text-2xl md:text-4xl font-medium tracking-tight ${robotoMono.className}`}>min</div>
        <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">(</div>
        <div className="flex-1 max-w-2xl px-4">
          <FileUpload />
        </div>
        <div className="text-4xl md:text-7xl font-light tracking-tighter text-muted-foreground">)</div>
      </div>
    </main>
  )
}

