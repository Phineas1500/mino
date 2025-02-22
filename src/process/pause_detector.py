from pathlib import Path
import whisper
import moviepy.editor as mp
import numpy as np

def detect_and_cut_pauses(video_path: str, min_pause_duration: float = 0.5) -> str:
    """
    Detects and removes pauses in a video that are longer than min_pause_duration.
    
    Args:
        video_path: Path to the input video file
        min_pause_duration: Minimum duration (in seconds) to consider as a pause
    
    Returns:
        Path to the processed video file
    """
    print(f"Processing video: {video_path}")
    
    # Load video
    video = mp.VideoFileClip(video_path)
    
    # Get audio and transcribe
    print("Transcribing audio...")
    model = whisper.load_model("base")
    result = model.transcribe(video_path)
    segments = result["segments"]
    
    # Find pauses between segments
    pauses = []
    for i in range(len(segments) - 1):
        current_end = segments[i]["end"]
        next_start = segments[i + 1]["start"]
        pause_duration = next_start - current_end
        
        if pause_duration >= min_pause_duration:
            pauses.append((current_end, next_start))
            print(f"Found pause: {pause_duration:.2f}s at {current_end:.2f}s")
    
    if not pauses:
        print("No significant pauses found")
        return video_path
    
    # Cut out the pauses
    print("Cutting out pauses...")
    clips = []
    last_time = 0
    
    # Keep the segments between pauses
    for pause_start, pause_end in pauses:
        if pause_start > last_time:
            clips.append(video.subclip(last_time, pause_start))
        last_time = pause_end
    
    # Add the final segment
    if last_time < video.duration:
        clips.append(video.subclip(last_time, video.duration))
    
    # Concatenate all clips
    final_video = mp.concatenate_videoclips(clips)
    
    # Generate output path
    input_path = Path(video_path)
    output_path = input_path.parent / f"{input_path.stem}_no_pauses{input_path.suffix}"
    
    # Write the final video
    print(f"Saving video to: {output_path}")
    final_video.write_videofile(
        str(output_path),
        codec="libx264",
        audio_codec="aac"
    )
    
    # Clean up
    video.close()
    final_video.close()
    
    return str(output_path)

if __name__ == "__main__":
    # Example usage
    video_path = "/Users/rickywong/mino/src/process/test_files/test_video.mp4"
    output_path = detect_and_cut_pauses(video_path, min_pause_duration=0.5)
    print(f"Processed video saved to: {output_path}")
