from moviepy.editor import ColorClip, concatenate_videoclips, AudioFileClip
from gtts import gTTS
import os
from pathlib import Path

def create_test_video():
    # Create test directory
    test_dir = Path(__file__).parent / 'test_files'
    test_dir.mkdir(exist_ok=True)
    
    # Create speech audio files
    temp_audio1 = test_dir / "temp_audio1.mp3"
    temp_audio2 = test_dir / "temp_audio2.mp3"
    
    # Generate speech
    tts1 = gTTS("Hello, this is a test video", lang='en')
    tts2 = gTTS("And this is the second part after a pause", lang='en')
    tts1.save(str(temp_audio1))
    tts2.save(str(temp_audio2))
    
    # Create video clips with matching durations
    audio1 = AudioFileClip(str(temp_audio1))
    audio2 = AudioFileClip(str(temp_audio2))
    
    clip1 = ColorClip((320, 240), color=(0,0,255)).set_duration(audio1.duration)  # Blue
    pause = ColorClip((320, 240), color=(0,0,0)).set_duration(2)                  # 2 second pause
    clip2 = ColorClip((320, 240), color=(255,0,0)).set_duration(audio2.duration)  # Red
    
    # Add audio to clips
    clip1 = clip1.set_audio(audio1)
    clip2 = clip2.set_audio(audio2)
    
    # Combine all clips
    final = concatenate_videoclips([clip1, pause, clip2])
    
    # Save the test video
    output_path = test_dir / 'test_video.mp4'
    final.write_videofile(str(output_path), fps=24)
    print(f"Created test video at: {output_path}")
    
    # Cleanup
    for temp_file in [temp_audio1, temp_audio2]:
        if temp_file.exists():
            os.remove(temp_file)

if __name__ == '__main__':
    create_test_video() 