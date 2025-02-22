import whisper
from pathlib import Path
import moviepy.editor as mp
import os

def transcribe_video(video_path):
    print(f"Loading video and extracting audio...")
    
    # Extract audio from video first
    video = mp.VideoFileClip(str(video_path))
    temp_audio_path = video_path.with_suffix('.wav')
    video.audio.write_audiofile(str(temp_audio_path), codec='pcm_s16le')
    video.close()
    
    try:
        print(f"Loading Whisper model...")
        model = whisper.load_model("base")
        
        print(f"Transcribing audio...")
        result = model.transcribe(str(temp_audio_path))
        
        # Create output path with same name as video but .txt extension
        output_path = video_path.with_suffix('.txt')
        
        # Write results to file
        with open(output_path, 'w', encoding='utf-8') as f:
            # Write full transcription
            f.write("Full Transcription:\n")
            f.write("=================\n\n")
            f.write(result["text"])
            f.write("\n\n")
            
            # Write segments with timestamps
            f.write("Segments with Timestamps:\n")
            f.write("=======================\n\n")
            for segment in result["segments"]:
                start = segment["start"]
                end = segment["end"]
                text = segment["text"]
                f.write(f"[{start:.2f}s -> {end:.2f}s] {text}\n")
        
        print(f"\nTranscription saved to: {output_path}")
        return output_path
        
    finally:
        # Clean up temporary audio file
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
            print("Cleaned up temporary audio file")

if __name__ == "__main__":
    video_path = Path("/Users/rickywong/mino/src/process/test_files/test_video.mp4")
    if not video_path.exists():
        print(f"Error: Video file not found at {video_path}")
    else:
        output_file = transcribe_video(video_path)
        print(f"Transcription complete! Check {output_file} for results.")