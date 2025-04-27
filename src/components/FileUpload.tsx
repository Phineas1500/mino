'use client'

import { useState, useRef, useEffect } from "react"
// Add Link icon or similar for the URL input
import { Upload, Loader2, Link as LinkIcon } from "lucide-react" 
import { compressVideo, shouldCompress } from '../components/videoCompressor';
import { useRouter } from 'next/navigation';

interface FileUploadProps {
  onFileSelect?: (file: File) => void
  onProcessingComplete?: (data: any) => void
  accept?: string
}

interface ProcessResponse {
  success: boolean
  error?: string
  originalUrl?: string
  data?: {
    transcript: string
    segments: any[]
    summary: string
    keyPoints: string[]
    flashcards: any[]
  }
}

export function FileUpload({ onFileSelect, onProcessingComplete, accept = "video/*" }: FileUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null)
  // Add state for YouTube URL input
  const [youtubeUrl, setYoutubeUrl] = useState(''); 
  const [uploading, setUploading] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
    message: string
  }>({ status: 'idle', message: '' })
  const [uploadGlow, setUploadGlow] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null); // State to store the job ID
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for the polling timer
  
  // Add refs to store abort controllers
  const uploadAbortController = useRef<AbortController | null>(null)
  const processAbortController = useRef<AbortController | null>(null)

  const handleCancel = () => {
    stopPolling(); // Stop polling on cancel
    // Abort any ongoing requests
    uploadAbortController.current?.abort()
    processAbortController.current?.abort()
    
    // Reset state
    setProgress({ status: 'idle', message: '' })
    setUploading(false)
    setFile(null)
    setUploadGlow(false)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const compressedBlob = await shouldCompress(file) 
      ? await compressVideo(file)
      : file;

    const compressedFile = new File(
      [compressedBlob], 
      file.name, 
      { type: file.type, lastModified: file.lastModified }
    );

    setFile(compressedFile)
    setUploading(true)
    setUploadGlow(true)
    setProgress({ status: 'uploading', message: 'Getting upload URL...' })

    let isConflict = false; // Declare isConflict here, outside the try block

    try {
      // Create new abort controller for this upload
      uploadAbortController.current = new AbortController()

      // Step 1: Get presigned URL with retry logic
      let urlResponse: Response | undefined
      let retries = 3
      while (retries > 0) {
        try {
          urlResponse = await fetch('/api/s3/presigned', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: compressedFile.name,
              fileType: compressedFile.type
            }),
            signal: uploadAbortController.current.signal
          })
          if (urlResponse.ok) break
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Upload cancelled')
          }
          console.warn(`Attempt ${4 - retries} failed, retrying...`)
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      if (!urlResponse?.ok) {
        const errorData = await urlResponse?.text()
        throw new Error(`Failed to get upload URL: ${errorData}`)
      }

      const { url, fields } = await urlResponse.json()
      console.log('Received presigned URL:', url)
      
      setProgress({ status: 'uploading', message: 'Uploading to S3...' })

      // Step 2: Upload to S3 with retry logic and abort signal
      let uploadResponse: Response | undefined
      retries = 3
      while (retries > 0) {
        try {
          uploadResponse = await fetch(url, {
            method: 'PUT',
            body: compressedFile,
            headers: {
              'Content-Type': compressedFile.type
            },
            signal: uploadAbortController.current.signal
          })
          if (uploadResponse.ok) break
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Upload cancelled')
          }
          console.warn(`Upload attempt ${4 - retries} failed, retrying...`)
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      if (!uploadResponse?.ok) {
        const errorText = await uploadResponse?.text()
        throw new Error(`Failed to upload to S3: ${errorText}`)
      }

      // Step 3: Initiate video processing
      setProgress({ status: 'processing', message: 'Initiating processing...' });
      processAbortController.current = new AbortController(); // Keep abort controller if needed for initial request
      
      let initialProcessResponse: Response;
      try {
        // Make the initial request to start processing
        initialProcessResponse = await fetch('/api/process-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileKey: fields.key }),
          signal: processAbortController.current.signal // Optional: timeout for initial request
        });

        if (initialProcessResponse.status === 409) {
          console.warn('Processing conflict detected (409)');
          setProgress({ 
            status: 'error', 
            message: 'This video is already being processed. Please wait.' 
          });
          isConflict = true; 
          // No need to return here yet, let finally block handle cleanup
        } else if (initialProcessResponse.status === 202) {
          // --- Processing Accepted ---
          const { jobId: receivedJobId } = await initialProcessResponse.json();
          if (!receivedJobId) {
            throw new Error('Processing initiated but no Job ID received.');
          }
          setJobId(receivedJobId); // Store the job ID
          setProgress({ status: 'processing', message: 'Processing video... (0%)' }); // Update message
          startPolling(receivedJobId); // Start polling for status
          // Don't navigate yet, wait for polling result
        } else {
          // Handle other unexpected initial responses (e.g., 500)
          const errorText = await initialProcessResponse.text();
          throw new Error(`Failed to initiate processing (Status: ${initialProcessResponse.status}): ${errorText}`);
        }

      } catch (error) {
         // Handle fetch errors for the initial request
         if (error instanceof Error && error.name === 'AbortError') {
           throw new Error('Initiating processing cancelled or timed out.');
         }
         console.error('Error initiating processing:', error);
         // Rethrow or handle as appropriate
         throw error; 
      }
      
    } catch (error) {
      console.error('Upload/processing failed:', error);
      // Stop polling if an error occurs during the setup phase
      stopPolling(); 
      // isConflict might be true or false here
      setProgress({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Upload failed' 
      });
    } finally {
      // Only reset uploading state if it's NOT a conflict AND polling hasn't started
      if (!isConflict && !jobId) { 
         setUploading(false);
      }
      // Keep uploadGlow logic as is or adjust
      setTimeout(() => setUploadGlow(false), 1000);
      // Clear abort controllers (maybe keep processAbortController if used for polling?)
      uploadAbortController.current = null;
      // processAbortController.current = null; // Decide if needed for polling cancel
    }
  }

  // --- NEW: Handler for YouTube URL submission ---
  const handleUrlSubmit = async () => {
    if (!youtubeUrl || uploading) return; // Prevent submission if empty or already processing

    // Basic URL validation (optional, enhance as needed)
    if (!youtubeUrl.startsWith('http://') && !youtubeUrl.startsWith('https://')) {
       setProgress({ status: 'error', message: 'Please enter a valid URL.' });
       return;
    }

    setUploading(true);
    setUploadGlow(true); // Optional glow effect
    setProgress({ status: 'processing', message: 'Requesting video download from URL...' }); // Initial message
    setFile(null); // Clear any selected file
    setYoutubeUrl(''); // Clear the input field

    let isConflict = false; // Reuse conflict flag logic if applicable

    try {
      // Use processAbortController for this request as well
      processAbortController.current = new AbortController();

      // Step 1: Call the new API route to handle the URL
      const urlProcessResponse = await fetch('/api/process-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
        signal: processAbortController.current.signal
      });

      // Step 2: Handle the response (similar to file upload initiation)
      if (urlProcessResponse.status === 409) {
        console.warn('Processing conflict detected (409) for URL');
        setProgress({ 
          status: 'error', 
          message: 'This video (or another) is already being processed. Please wait.' 
        });
        isConflict = true;
      } else if (urlProcessResponse.status === 202) {
        const { jobId: receivedJobId } = await urlProcessResponse.json();
        if (!receivedJobId) {
          throw new Error('Processing initiated for URL but no Job ID received.');
        }
        setJobId(receivedJobId);
        // Update progress message - backend handles download/upload before processing starts
        setProgress({ status: 'processing', message: 'Video processing started... (0%)' }); 
        startPolling(receivedJobId); // Start polling
      } else {
        const errorText = await urlProcessResponse.text();
        throw new Error(`Failed to initiate processing for URL (Status: ${urlProcessResponse.status}): ${errorText}`);
      }

    } catch (error) {
      console.error('YouTube URL processing failed:', error);
      stopPolling(); 
      setProgress({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to process YouTube URL' 
      });
    } finally {
      // Reset uploading state only if not a conflict and polling hasn't started
      if (!isConflict && !jobId) { 
         setUploading(false);
      }
      setTimeout(() => setUploadGlow(false), 1000);
      processAbortController.current = null; 
    }
  };

  const pollStatus = async (currentJobId: string) => {
    console.log(`Polling status for job: ${currentJobId}`);
    try {
      const statusResponse = await fetch(`/api/process-status?jobId=${currentJobId}`);

      if (!statusResponse.ok) {
        // Handle non-OK status check responses (e.g., 404 Not Found, 500)
        console.error(`Status check failed with status: ${statusResponse.status}`);
        // Optionally stop polling after too many errors
        return; 
      }

      const result = await statusResponse.json();

      switch (result.status) {
        case 'processing':
          // Update progress message if needed (e.g., include percentage if available)
          setProgress(prev => ({ ...prev, message: `Processing video... (${result.progress || 0}%)` }));
          // Continue polling (handled by setInterval)
          break;
        case 'complete':
          console.log('Processing complete:', result.data);
          stopPolling(); // Stop polling on success
          setProgress({ status: 'done', message: 'Video processed successfully!' });
          
          // *** Remove or comment out sessionStorage saving ***
          // console.log('Saving lessonData to sessionStorage:', lessonData); 
          // sessionStorage.setItem("lessonData", JSON.stringify(lessonData));
          // if (result.data?.originalUrl) {
          //    sessionStorage.setItem("videoUrl", result.data.originalUrl);
          //    sessionStorage.setItem("shortenedUrl", result.data.originalUrl); 
          // }

          // Call the prop if provided (optional, might not be needed anymore)
          // if (onProcessingComplete) {
          //    onProcessingComplete(lessonData);
          // }
          
          setProcessedUrl(result.data?.originalUrl || null); // Keep if you show preview on upload page
          setUploading(false); // Allow new uploads now

          // *** Navigate to the dynamic route using the jobId ***
          router.push(`/video/${currentJobId}`); // Use the jobId from polling

          break; // End of case 'complete'
        case 'error':
          console.error('Processing failed:', result.message);
          stopPolling(); // Stop polling on error
          setProgress({ status: 'error', message: `Processing failed: ${result.message}` });
          setUploading(false); // Allow new uploads now
          break;
        case 'not_found':
          console.error(`Job ID ${currentJobId} not found.`);
          stopPolling();
          setProgress({ status: 'error', message: 'Processing job not found.' });
          setUploading(false);
          break;
        default:
          console.warn(`Unknown status received: ${result.status}`);
          // Optionally stop polling or handle as error
      }
    } catch (error) {
      console.error('Error during polling:', error);
      // Optionally stop polling after too many network errors
    }
  };

  const startPolling = (currentJobId: string) => {
    stopPolling(); // Clear any existing interval first
    console.log(`Starting polling for job: ${currentJobId}`);
    // Poll immediately first time
    pollStatus(currentJobId); 
    // Then poll every 5 seconds (adjust interval as needed)
    pollingIntervalRef.current = setInterval(() => pollStatus(currentJobId), 5000); 
  };

  const getProgressPercentage = () => {
    switch (progress.status) {
      case 'idle':
        return 0;
      case 'uploading':
        return 33;
      case 'processing':
        return 66;
      case 'done':
        return 100;
      case 'error':
        return 0;
      default:
        return 0;
    }
  }

  // Function to stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('Polling stopped.');
    }
  };

  // Add useEffect for cleanup when component unmounts
  useEffect(() => {
    // Cleanup function to stop polling if the component unmounts
    return () => {
      stopPolling();
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {uploadGlow && (
        <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
          <div className="w-[500%] h-[150%] rounded-full bg-blue-300/30 blur-3xl scale-0 animate-[glow_1s_ease-out]"></div>
        </div>
      )}
      <div className="relative w-full max-w-4xl bg-black aspect-[36/9] border border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors rounded-lg p-8">
        <input
          type="file"
          id="video-upload"
          className="hidden"
          accept={accept}
          onChange={handleUpload}
          disabled={uploading}
        />
        <label
          htmlFor="video-upload"
          className="flex flex-col items-center cursor-pointer"
        >
          {progress.status === 'uploading' || progress.status === 'processing' ? (
            <Loader2 className="w-8 h-8 mb-4 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
          )}
          <span className="text-base mb-1">
            {progress.status === 'idle' 
              ? "Drop your lecture video here"
              : progress.message
            }
          </span>
          <span className="text-sm text-muted-foreground">
            MP4, WebM, or MOV up to 2GB
          </span>
        </label>
        
        {file && (
          <div className="mt-4 text-sm text-muted-foreground">
            Selected: {file.name}
          </div>
        )}
        
        {progress.status !== 'idle' && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <div className={`text-sm ${
                progress.status === 'error' ? 'text-red-500' : 
                progress.status === 'done' ? 'text-green-500' : 
                'text-blue-500'
              }`}>
                {progress.message}
              </div>
              {(progress.status === 'uploading' || progress.status === 'processing') && (
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm text-red-500 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            {progress.status !== 'error' && (
              <div className="w-full mt-4">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ease-out rounded-full ${
                      progress.status === 'done' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ 
                      width: `${getProgressPercentage()}%`,
                      transition: 'width 0.5s ease-out'
                    }}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  {getProgressPercentage()}%
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* "OR" Separator */}
      <div className="flex items-center w-full max-w-sm">
        <div className="flex-grow border-t border-muted-foreground/30"></div>
        <span className="flex-shrink mx-4 text-muted-foreground text-sm">OR</span>
        <div className="flex-grow border-t border-muted-foreground/30"></div>
      </div>

      {/* YouTube URL Input Area */}
      <div className="w-full max-w-xl flex gap-2">
        <div className="relative flex-grow">
           <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
           <input
             type="url"
             placeholder="Paste YouTube video link here"
             value={youtubeUrl}
             onChange={(e) => setYoutubeUrl(e.target.value)}
             disabled={uploading} // Disable while processing
             className="w-full pl-10 pr-4 py-2 rounded-md border border-muted-foreground/30 bg-black focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
           />
        </div>
        <button
          onClick={handleUrlSubmit}
          disabled={uploading || !youtubeUrl} // Disable if processing or URL is empty
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Process Link
        </button>
      </div>

      {processedUrl && progress.status === 'done' && (
        <div className="w-full max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Processed Video</h2>
          <video 
            src={processedUrl} 
            controls 
            className="w-full rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  )
}