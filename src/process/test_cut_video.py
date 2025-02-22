import unittest
import os
from pathlib import Path
from cut_video import cut_video

class TestCutVideo(unittest.TestCase):
    def setUp(self):
        # Create test files directory if it doesn't exist
        self.test_dir = Path(__file__).parent / 'test_files'
        self.test_dir.mkdir(exist_ok=True)
        
        # Define test video path
        self.test_video_path = self.test_dir / 'test_video.mp4'

    def test_cut_video(self):
        # Check if the test video file exists
        if not self.test_video_path.exists():
            self.fail(
                f"\nTest video file not found at: {self.test_video_path}\n"
                "Please create a test video with the following specifications:\n"
                "1. Duration: 5-10 seconds\n"
                "2. Format: MP4\n"
                "3. Content: Include some speech with clear pauses\n"
                "4. Example: Record yourself saying 'Hello [pause] World'\n"
            )

        try:
            # Run the cut_video function
            edited_video_path = cut_video(str(self.test_video_path))

            # Assert that a new video file was created
            self.assertTrue(
                Path(edited_video_path).exists(),
                f"Expected edited video at {edited_video_path} but file was not created"
            )

            # TODO: Add more assertions
            # 1. Check if the edited video is shorter than the original
            # 2. Verify that the audio is still in sync
            # 3. Confirm that pauses were actually removed

        finally:
            # Clean up any created files
            try:
                if 'edited_video_path' in locals():
                    Path(edited_video_path).unlink(missing_ok=True)
            except Exception as e:
                print(f"Warning: Failed to clean up test files: {e}")

if __name__ == '__main__':
    unittest.main()
