import whisper
import moviepy.editor as mp
import os

def cut_video(video_path, pause_threshold=0.5):
    """
    Cuts pauses from a video file using Whisper for transcription and moviepy for editing.

    Args:
        video_path (str): Path to the video file.
        pause_threshold (float): Minimum duration of a pause (in seconds) to be cut.
    """

    # 1. Transcribe the Audio with Whisper
    audio_path = extract_audio(video_path)
    segments = transcribe_audio(audio_path)

    # 2. Identify Pauses
    pause_segments = identify_pauses(segments, pause_threshold)

    # 3. Edit the Video to Remove Pauses
    final_video_path = edit_video(video_path, pause_segments)

    return final_video_path

def extract_audio(video_path):
    """Extracts audio from the video file."""
    video = mp.VideoFileClip(video_path)
    audio_path = "temp_audio.wav"  # Temporary audio file
    video.audio.write_audiofile(audio_path)
    return audio_path

def transcribe_audio(audio_path):
    """Transcribes the audio using Whisper."""
    model = whisper.load_model("base")  # You can choose different models
    result = model.transcribe(audio_path)
    segments = result["segments"]
    return segments

def identify_pauses(segments, pause_threshold):
    """Identifies pauses based on the transcribed segments."""
    pause_segments = []
    for i in range(len(segments) - 1):
        segment1 = segments[i]
        segment2 = segments[i + 1]
        pause_duration = segment2["start"] - segment1["end"]
        if pause_duration > pause_threshold:
            pause_segments.append((segment1["end"], segment2["start"]))  # Store pause start and end times
    return pause_segments

def edit_video(video_path, pause_segments):
    """Edits the video to remove pauses."""
    video = mp.VideoFileClip(video_path)
    clips = []
    last_end = 0
    for start, end in pause_segments:
        clips.append(video.subclip(last_end, start))  # Keep segments before pauses
        last_end = end
    clips.append(video.subclip(last_end, video.duration))  # Add the final segment
    final_clip = mp.concatenate_videoclips(clips)
    final_video_path = "edited_video.mp4"
    final_clip.write_videofile(final_video_path, codec="libx264", audio_codec="aac")
    return final_video_path

if __name__ == '__main__':
    # Example usage:
    video_path = "path/to/your/video.mp4"  # Replace with your video file path
    edited_video_path = cut_video(video_path)
    print(f"Edited video saved to: {edited_video_path}")