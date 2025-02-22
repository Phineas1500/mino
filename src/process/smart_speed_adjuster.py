import whisper
from moviepy.editor import VideoFileClip
from pathlib import Path
import re

def analyze_content_importance(text):
    """
    Analyzes text to determine content importance.
    Returns a score between 0 (less important) and 1 (very important)
    """
    # Keywords that indicate important content
    important_keywords = {
        'equation': 1.0,
        'theorem': 1.0,
        'proof': 1.0,
        'definition': 1.0,
        'example': 0.8,
        'important': 0.8,
        'key concept': 0.9,
        'remember': 0.8,
        'note': 0.7,
    }
    
    # Keywords that indicate less important content
    casual_keywords = {
        'um': 0.3,
        'uh': 0.3,
        'like': 0.4,
        'anyway': 0.4,
        'so': 0.5,
        'by the way': 0.3,
        'funny': 0.3,
        'story': 0.3,
    }
    
    # Calculate base importance
    score = 0.6  # default importance
    text_lower = text.lower()
    
    # Check for important keywords
    for keyword, weight in important_keywords.items():
        if keyword in text_lower:
            score = max(score, weight)
    
    # Check for casual keywords
    for keyword, weight in casual_keywords.items():
        if keyword in text_lower:
            score = min(score, weight)
    
    return score

def smart_speed_adjust(video_path: str, min_speed=1.0, max_speed=2.0):
    """
    Adjusts video speed based on content importance from transcript.
    """
    print("Loading video...")
    video = VideoFileClip(video_path)
    
    print("Transcribing with Whisper...")
    model = whisper.load_model("base")
    result = model.transcribe(video_path)
    segments = result["segments"]
    
    print("Processing segments...")
    clips = []
    
    for segment in segments:
        start_time = segment["start"]
        end_time = segment["end"]
        text = segment["text"]
        
        # Analyze content importance
        importance = analyze_content_importance(text)
        
        # Calculate speed (more important = slower)
        speed = min_speed + (1 - importance) * (max_speed - min_speed)
        
        # Create segment with adjusted speed
        clip = video.subclip(start_time, end_time).speedx(speed)
        clips.append(clip)
        
        print(f"Segment: {start_time:.1f}s - {end_time:.1f}s")
        print(f"Content: {text.strip()}")
        print(f"Importance: {importance:.2f}, Speed: {speed:.2f}x\n")
    
    # Concatenate all clips
    print("Concatenating clips...")
    final_video = VideoFileClip.concatenate(clips)
    
    # Save the result
    output_path = str(Path(video_path).with_stem(f"{Path(video_path).stem}_smart"))
    print(f"Saving to {output_path}...")
    final_video.write_videofile(output_path)
    
    # Cleanup
    video.close()
    final_video.close()
    
    return output_path

if __name__ == "__main__":
    video_path = "/Users/rickywong/mino/src/process/test_files/lecture.mp4"
    output_path = smart_speed_adjust(video_path)
    
    # Print time saved
    original = VideoFileClip(video_path)
    processed = VideoFileClip(output_path)
    time_saved = original.duration - processed.duration
    print(f"\nProcessing complete!")
    print(f"Original duration: {original.duration:.1f}s")
    print(f"New duration: {processed.duration:.1f}s")
    print(f"Time saved: {time_saved:.1f}s ({(time_saved/original.duration)*100:.1f}%)")
