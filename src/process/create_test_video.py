from moviepy.editor import ColorClip, concatenate_videoclips, AudioFileClip
import numpy as np

def create_test_video():
    # Create test directory
    from pathlib import Path
    test_dir = Path(__file__).parent / 'test_files'
    test_dir.mkdir(exist_ok=True)
    
    # Create colored clips with different durations
    clip1 = ColorClip((320, 240), color=(0,0,255)).set_duration(2)  # Blue
    pause = ColorClip((320, 240), color=(0,0,0)).set_duration(1)    # Black pause
    clip2 = ColorClip((320, 240), color=(255,0,0)).set_duration(2)  # Red
    
    # Combine clips
    final = concatenate_videoclips([clip1, pause, clip2])
    
    # Save the test video
    output_path = test_dir / 'test_video.mp4'
    final.write_videofile(str(output_path), fps=24)
    print(f"Created test video at: {output_path}")

if __name__ == '__main__':
    create_test_video() 