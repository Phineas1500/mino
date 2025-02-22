import cv2
import numpy as np
from moviepy.editor import VideoFileClip, clips_array, vfx
import librosa
import scipy.signal as signal

def adjust_video_speed(video_path: str, 
                      min_speed: float = 0.8,
                      max_speed: float = 2.0):
    """
    Adjusts video speed based on:
    1. Visual complexity (more complex = slower)
    2. Speech rate (faster speech = slower video)
    3. Audio energy (higher energy = likely important content)
    """
    print(f"Processing video: {video_path}")
    video = VideoFileClip(video_path)
    
    # Extract frames for visual analysis
    def get_frame_complexity(frame):
        # Convert to grayscale and calculate edge density
        gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        return np.count_nonzero(edges) / edges.size

    # Extract audio features
    audio = video.audio
    audio_array = audio.to_soundarray()
    sample_rate = audio.fps
    
    # Calculate speech rate using zero-crossing rate
    hop_length = int(sample_rate * 0.1)  # 100ms windows
    zcr = librosa.feature.zero_crossing_rate(y=audio_array.mean(axis=1), 
                                           hop_length=hop_length)[0]
    
    # Calculate audio energy
    rms = librosa.feature.rms(y=audio_array.mean(axis=1), 
                             hop_length=hop_length)[0]
    
    # Process video in segments
    segment_duration = 1.0  # 1-second segments
    segments = []
    
    for t in np.arange(0, video.duration, segment_duration):
        # Get frame at time t
        frame = video.get_frame(t)
        visual_complexity = get_frame_complexity(frame)
        
        # Get audio features for this segment
        segment_idx = int(t * sample_rate / hop_length)
        speech_rate = zcr[segment_idx] if segment_idx < len(zcr) else zcr[-1]
        energy = rms[segment_idx] if segment_idx < len(rms) else rms[-1]
        
        # Combine features to determine speed
        # Higher complexity/speech rate/energy = slower speed
        features_avg = np.mean([
            visual_complexity,
            speech_rate / np.max(zcr),
            energy / np.max(rms)
        ])
        
        # Map features to speed range
        speed = max_speed - (features_avg * (max_speed - min_speed))
        speed = np.clip(speed, min_speed, max_speed)
        
        # Create segment with adjusted speed
        segment = video.subclip(t, min(t + segment_duration, video.duration))
        segments.append(segment.speedx(speed))
        
    # Concatenate all segments
    final_video = clips_array([segments])
    
    # Save the result
    output_path = video_path.replace('.mp4', '_adjusted.mp4')
    final_video.write_videofile(output_path)
    
    # Cleanup
    video.close()
    final_video.close()
    
    return output_path

if __name__ == "__main__":
    video_path = "/Users/rickywong/mino/src/process/test_files/test_video.mp4"
    output_path = adjust_video_speed(video_path)
    print(f"Processed video saved to: {output_path}")
