'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react" // Import ChangeEvent
import { Upload, Loader2, Link as LinkIcon, CheckCircle2, XCircle } from "lucide-react" 
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

// --- Define more detailed status stages ---
type ProcessingStage = 
  | 'idle' 
  | 'getting_upload_url' 
  | 'uploading_to_s3' 
  | 'initiating_processing' 
  | 'pending' // Waiting in backend queue
  | 'downloading' // YouTube specific
  | 'uploading_original' // YouTube specific
  | 'preparing' 
  | 'transcribing' 
  | 'analyzing' 
  | 'generating_summary' // Example stages
  | 'generating_keypoints'
  | 'generating_flashcards'
  | 'finalizing' 
  | 'complete' 
  | 'error';

// --- Update Progress State Structure ---
interface ProgressState {
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'; // Overall status
  stage: ProcessingStage; // Specific step
  message: string; // User-friendly message
  percentage: number; // Overall percentage (0-100)
}
// --- End Update ---

// --- ADD mobile detection utility here ---
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false; 
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
// --- End ADD ---

export function FileUpload({ onFileSelect, onProcessingComplete, accept = "video/*" }: FileUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState(''); 
  const [uploading, setUploading] = useState(false)
  // const [processedUrl, setProcessedUrl] = useState<string | null>(null) // Remove if not showing preview here
  
  // --- Use updated ProgressState ---
  const [progress, setProgress] = useState<ProgressState>({ 
    status: 'idle', 
    stage: 'idle', 
    message: '', 
    percentage: 0 
  });
  // --- End Use ---

  const [uploadGlow, setUploadGlow] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null); 
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); 
  const uploadAbortController = useRef<AbortController | null>(null)
  const processAbortController = useRef<AbortController | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false); 

  const handleCancel = () => {
    stopPolling(); 
    uploadAbortController.current?.abort()
    processAbortController.current?.abort()
    
    // Reset state
    setProgress({ status: 'idle', stage: 'idle', message: '', percentage: 0 }); // Reset progress state
    setUploading(false)
    setFile(null)
    setJobId(null); // Reset jobId
    setUploadGlow(false)
    setIsDraggingOver(false); 
  }

  // --- Update startUploadProcess to use new progress state ---
  const startUploadProcess = async (selectedFile: File) => {
    if (!selectedFile || uploading) return; 

    setFile(selectedFile); 
    setUploading(true);
    setUploadGlow(true);
    setProgress({ status: 'uploading', stage: 'idle', message: 'Preparing upload...', percentage: 0 }); 

    let fileToUpload: File = selectedFile; 

    // --- Upload Steps ---
    let isConflict = false; 
    const uploadStartPercentage = 0; // Where the upload phase starts

    try {
      uploadAbortController.current = new AbortController();
      setProgress(prev => ({ ...prev, stage: 'getting_upload_url', message: 'Getting upload URL...', percentage: uploadStartPercentage + 5 })); // Small bump

      // Step 1: Get presigned URL 
      // ... (fetch /api/s3/presigned) ...
      let urlResponse: Response | undefined
      let retries = 3
      while (retries > 0) {
        try {
          urlResponse = await fetch('/api/s3/presigned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: fileToUpload.name, fileType: fileToUpload.type }),
            signal: uploadAbortController.current.signal
          })
          if (urlResponse.ok) break
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') throw new Error('Upload cancelled');
          console.warn(`Attempt ${4 - retries} failed, retrying...`);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      if (!urlResponse?.ok) {
        const errorData = await urlResponse?.text();
        throw new Error(`Failed to get upload URL: ${errorData}`);
      }
      const { url, fields } = await urlResponse.json();
      
      setProgress(prev => ({ ...prev, stage: 'uploading_to_s3', message: 'Uploading to S3...', percentage: uploadStartPercentage + 15 })); // Bump percentage

      // Step 2: Upload to S3
      // ... (fetch PUT to S3 url) ...
      let uploadResponse: Response | undefined
      retries = 3
      while (retries > 0) {
        try {
          uploadResponse = await fetch(url, {
            method: 'PUT',
            body: fileToUpload,
            headers: { 'Content-Type': fileToUpload.type },
            signal: uploadAbortController.current.signal
          })
          if (uploadResponse.ok) break
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') throw new Error('Upload cancelled');
          console.warn(`Upload attempt ${4 - retries} failed, retrying...`);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      if (!uploadResponse?.ok) {
        const errorText = await uploadResponse?.text();
        throw new Error(`Failed to upload to S3: ${errorText}`);
      }

      setProgress(prev => ({ ...prev, stage: 'initiating_processing', message: 'Initiating processing...', percentage: uploadStartPercentage + 30 })); // Bump percentage

      // Step 3: Initiate video processing
      processAbortController.current = new AbortController(); 
      let initialProcessResponse: Response;
      try {
        initialProcessResponse = await fetch('/api/process-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileKey: fields.key }),
          signal: processAbortController.current.signal
        });
        
        if (initialProcessResponse.status === 409) {
          // ... handle conflict ...
          console.warn('Processing conflict detected (409)');
          setProgress({ status: 'error', stage: 'initiating_processing', message: 'This video is already being processed. Please wait.', percentage: progress.percentage });
          isConflict = true; 
        } else if (initialProcessResponse.status === 202) {
          const { jobId: receivedJobId } = await initialProcessResponse.json();
          // ... handle success ...
          if (!receivedJobId) throw new Error('Processing initiated but no Job ID received.');
          setJobId(receivedJobId); 
          // Update status to 'processing' and stage to 'pending' (or first backend stage)
          setProgress({ 
              status: 'processing', 
              stage: 'pending', // Assume backend starts in pending
              message: 'Processing queued...', 
              percentage: uploadStartPercentage + 35 // Initial backend percentage
          }); 
          startPolling(receivedJobId); 
        } else {
          // ... handle other errors ...
          const errorText = await initialProcessResponse.text();
          throw new Error(`Failed to initiate processing (Status: ${initialProcessResponse.status}): ${errorText}`);
        }
      } catch (error) {
         // ... handle fetch error ...
         if (error instanceof Error && error.name === 'AbortError') throw new Error('Initiating processing cancelled or timed out.');
         console.error('Error initiating processing:', error);
         throw error; 
      }
      
    } catch (error) {
      console.error('Upload/processing failed:', error);
      stopPolling(); 
      // Use the stage from the last successful progress update
      setProgress(prev => ({ 
          status: 'error', 
          stage: prev.stage, // Keep last known stage
          message: error instanceof Error ? error.message : 'Upload failed',
          percentage: prev.percentage // Keep percentage
      }));
    } finally {
      // ... (finally logic, ensure setUploading(false) is handled correctly based on polling start) ...
       if (!isConflict && !jobId) { 
         setUploading(false);
       }
       setTimeout(() => setUploadGlow(false), 1000);
       uploadAbortController.current = null;
    }
  };

  // --- Update handleUrlSubmit ---
  const handleUrlSubmit = async () => {
    if (!youtubeUrl || uploading) return; // Prevent submission if empty or already processing

    // Basic URL validation (optional, enhance as needed)
    if (!youtubeUrl.startsWith('http://') && !youtubeUrl.startsWith('https://')) {
       setProgress({ status: 'error', stage: 'initiating_processing', message: 'Please enter a valid URL.', percentage: 5 });
       return;
    }

    setUploading(true);
    setUploadGlow(true); 
    // Initial progress for URL submission
    setProgress({ 
        status: 'processing', // Go straight to processing
        stage: 'initiating_processing', // Stage for calling our API
        message: 'Requesting video processing from URL...', 
        percentage: 5 // Small initial percentage
    }); 
    setFile(null); 
    setYoutubeUrl(''); 

    let isConflict = false; 

    try {
      processAbortController.current = new AbortController();
      const urlProcessResponse = await fetch('/api/process-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
        signal: processAbortController.current.signal
      });

      if (urlProcessResponse.status === 409) {
        // ... handle conflict ...
         console.warn('Processing conflict detected (409) for URL');
         setProgress({ status: 'error', stage: 'initiating_processing', message: 'This video (or another) is already being processed. Please wait.', percentage: 5 });
         isConflict = true;
      } else if (urlProcessResponse.status === 202) {
        const { jobId: receivedJobId } = await urlProcessResponse.json();
        // ... handle success ...
        setJobId(receivedJobId);
        // Assume backend starts downloading or pending
        setProgress({ 
            status: 'processing', 
            stage: 'pending', // Or 'downloading' if backend reports that first
            message: 'Video processing started...', 
            percentage: 10 // Slightly higher starting point for URL
        }); 
        startPolling(receivedJobId); 
      } else {
        // ... handle error ...
        const errorText = await urlProcessResponse.text();
        throw new Error(`Failed to initiate processing for URL (Status: ${urlProcessResponse.status}): ${errorText}`);
      }

    } catch (error) {
      console.error('YouTube URL processing failed:', error);
      stopPolling(); 
      setProgress({ 
        status: 'error', 
        stage: 'initiating_processing', // Error occurred during initiation
        message: error instanceof Error ? error.message : 'Failed to process YouTube URL',
        percentage: 5 // Keep initial percentage
      });
    } finally {
      // ... (finally logic) ...
      if (!isConflict && !jobId) { 
         setUploading(false);
      }
      setTimeout(() => setUploadGlow(false), 1000);
      processAbortController.current = null; 
    }
  };

  // --- Update Polling functions ---
  const pollStatus = async (currentJobId: string) => {
    console.log(`Polling status for job: ${currentJobId}`);
    try {
      const statusResponse = await fetch(`/api/process-status?jobId=${currentJobId}`);
      if (!statusResponse.ok) { /* ... handle error ... */ return; }

      // --- Expect enhanced status from API ---
      const result: { 
          status: 'processing' | 'complete' | 'error' | 'not_found'; 
          stage?: ProcessingStage; // Backend stage
          progress?: number; // Backend overall progress (0-100)
          message?: string; // Optional backend message
          data?: any; // Data on completion
      } = await statusResponse.json();
      // --- End Expect ---

      let currentStage = result.stage || progress.stage; // Use backend stage if available
      let currentPercentage = result.progress ?? progress.percentage; // Use backend progress if available
      let currentMessage = result.message || progress.message; // Use backend message if available

      // Generate a frontend message based on stage if backend didn't provide one
      if (!result.message && result.status === 'processing') {
          currentMessage = getMessageForStage(currentStage, currentPercentage);
      }

      switch (result.status) {
        case 'processing':
          setProgress({ 
              status: 'processing', 
              stage: currentStage, 
              message: currentMessage, 
              percentage: currentPercentage 
          });
          break;
        case 'complete':
          console.log('Processing complete:', result.data);
          stopPolling(); 
          setProgress({ 
              status: 'done', 
              stage: 'complete', 
              message: 'Video processed successfully!', 
              percentage: 100 
          });
          setUploading(false); 
          router.push(`/video/${currentJobId}`); 
          break; 
        case 'error':
          console.error('Processing failed:', result.message);
          stopPolling(); 
          setProgress({ 
              status: 'error', 
              stage: currentStage, // Stage where error occurred
              message: `Processing failed: ${result.message || 'Unknown backend error'}`, 
              percentage: currentPercentage // Keep percentage at point of failure
          });
          setUploading(false); 
          break;
        case 'not_found':
           // ... handle not found ...
           console.error(`Job ID ${currentJobId} not found.`);
           stopPolling();
           setProgress({ status: 'error', stage: 'error', message: 'Processing job not found.', percentage: 0 });
           setUploading(false);
           break;
        default:
          console.warn(`Unknown status received: ${result.status}`);
      }
    } catch (error) {
      console.error('Error during polling:', error);
      // Consider adding logic to stop polling after multiple errors
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
  const stopPolling = () => { 
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('Polling stopped.');
    }
  };
  useEffect(() => { 
    // Cleanup function to stop polling if the component unmounts
    return () => {
      stopPolling();
    };
  }, []); 

  // --- Helper to generate messages (customize as needed) ---
  const getMessageForStage = (stage: ProcessingStage, percentage: number): string => {
      switch (stage) {
          case 'getting_upload_url': return 'Getting upload URL...';
          case 'uploading_to_s3': return 'Uploading video...';
          case 'initiating_processing': return 'Initiating processing...';
          case 'pending': return 'Processing queued...';
          case 'downloading': return 'Downloading video...';
          case 'uploading_original': return 'Preparing video...';
          case 'preparing': return 'Preparing analysis...';
          case 'transcribing': return `Transcribing audio (${percentage}%)...`; // Use overall % here
          case 'analyzing': return `Analyzing transcript (${percentage}%)...`;
          case 'generating_summary': return 'Generating summary...';
          case 'generating_keypoints': return 'Generating key points...';
          case 'generating_flashcards': return 'Generating flashcards...';
          case 'finalizing': return 'Finalizing results...';
          case 'complete': return 'Video processed successfully!';
          case 'error': return 'An error occurred.';
          default: return `Processing (${percentage}%)...`;
      }
  };
  // --- End Helper ---

  // --- getProgressPercentage now just reads state ---
  const getProgressPercentage = () => {
    // Ensure percentage is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(progress.percentage))); 
  }
  // --- End Update ---

  // --- Drag/Drop handlers no change ---
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    if (!uploading) { // Only show feedback if not already uploading
        setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false); // Turn off visual feedback

    if (uploading) return; // Don't process drop if already uploading

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      // Optional: Check file type against 'accept' prop
      if (accept !== "*" && !accept.split(',').some(type => droppedFile.type.startsWith(type.trim().replace('*', '')))) {
          console.warn(`Dropped file type (${droppedFile.type}) does not match accepted types (${accept})`);
          setProgress({ status: 'error', stage: 'idle', message: `Invalid file type. Please drop a video file (${accept}).`, percentage: 0 });
          return;
      }
      console.log('File dropped:', droppedFile.name);
      startUploadProcess(droppedFile); // Use the refactored upload function
    }
  };

  // --- ADD Definition for handleFileInputChange ---
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      console.log('File selected via input:', selectedFile.name);
      startUploadProcess(selectedFile); // Call the main upload logic
    }
    // Reset the input value to allow selecting the same file again if needed
    e.target.value = ''; 
  };
  // --- End ADD ---

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {uploadGlow && (
        <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
          <div className="w-[500%] h-[150%] rounded-full bg-blue-300/30 blur-3xl scale-0 animate-[glow_1s_ease-out]"></div>
        </div>
      )}
      {/* --- Add drag event handlers to this div --- */}
      <div 
        className={`relative w-full max-w-4xl bg-black aspect-[36/9] border border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors rounded-lg p-8 ${
          isDraggingOver ? 'border-blue-500 border-dashed ring-2 ring-blue-500 ring-offset-2 ring-offset-black' : '' // Add visual feedback class
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="video-upload"
          className="hidden"
          accept={accept}
          onChange={handleFileInputChange} // Use the specific handler for input change
          disabled={uploading}
        />
        <label
          htmlFor="video-upload"
          className="flex flex-col items-center cursor-pointer"
        >
          {/* --- Update Icon based on status --- */}
          {progress.status === 'uploading' || progress.status === 'processing' ? (
            <Loader2 className="w-8 h-8 mb-4 text-muted-foreground animate-spin" />
          ) : progress.status === 'done' ? (
            <CheckCircle2 className="w-8 h-8 mb-4 text-green-500" />
          ) : progress.status === 'error' ? (
            <XCircle className="w-8 h-8 mb-4 text-red-500" />
          ) : (
            <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
          )}
          {/* --- End Update Icon --- */}
          <span className="text-base mb-1">
            {isDraggingOver 
              ? "Drop the video file here" 
              : progress.status === 'idle' 
                ? "Drop your lecture video here or click to browse" 
                : progress.message // Display the detailed message from state
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
              {/* --- Message is now part of the main label text, remove duplicate --- */}
              {/* <div className={`text-sm ${...}`}> {progress.message} </div> */}
              {(progress.status === 'uploading' || progress.status === 'processing') && (
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm text-red-500 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            {/* --- Progress Bar uses getProgressPercentage() which reads state --- */}
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
                {/* --- Optional: Show percentage text only during active processing --- */}
                {(progress.status === 'uploading' || progress.status === 'processing') && (
                  <div className="mt-2 text-xs text-muted-foreground text-center">
                    {getProgressPercentage()}%
                  </div>
                )}
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

      {/* ... Remove Processed Video Preview if not needed on upload page ... */}
      {/* {processedUrl && progress.status === 'done' && ( ... )} */}
    </div>
  )
}