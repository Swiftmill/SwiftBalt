import asyncio
import os
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, List
from app.core.config import settings


class FFmpegService:
    """
    Secure FFmpeg execution service for transcoding, muxing, audio extraction,
    and subtitle embedding using structured arguments without shell injection.
    """

    def __init__(self):
        self.ffmpeg_bin = shutil.which(settings.FFMPEG_PATH) or "ffmpeg"
        self.ffprobe_bin = shutil.which(settings.FFPROBE_PATH) or "ffprobe"

    async def is_available(self) -> bool:
        """Checks if ffmpeg is available in PATH or specified config."""
        try:
            proc = await asyncio.create_subprocess_exec(
                self.ffmpeg_bin,
                "-version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()
            return proc.returncode == 0
        except Exception:
            return False

    def estimate_size(self, duration_sec: float, video_bitrate_kbps: int = 2500, audio_bitrate_kbps: int = 192) -> int:
        """Estimates output file size in bytes given duration and target bitrates."""
        total_kbps = video_bitrate_kbps + audio_bitrate_kbps
        total_bits = total_kbps * 1000 * duration_sec
        return int(total_bits / 8)

    async def convert_video(
        self,
        input_file: Path,
        output_file: Path,
        target_format: str = "mp4",
        resolution: Optional[str] = None,
        fps: Optional[int] = None,
        video_bitrate: Optional[str] = None,
        audio_bitrate: str = "192k",
        progress_callback=None
    ) -> Path:
        """
        Transcodes video to MP4, WebM, or MKV securely with structured args.
        """
        output_file.parent.mkdir(parents=True, exist_ok=True)
        args: List[str] = [
            self.ffmpeg_bin,
            "-y",                     # Overwrite output
            "-i", str(input_file),    # Input path
        ]

        # Resolution scaling filter if specified (e.g., '1920:1080' or '1280:720')
        video_filters = []
        if resolution and "x" in resolution:
            w, h = resolution.split("x")
            video_filters.append(f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2")
        elif resolution and resolution.endswith("p"):
            h = resolution.rstrip("p")
            video_filters.append(f"scale=-2:{h}")

        if fps:
            args.extend(["-r", str(int(fps))])

        if video_filters:
            args.extend(["-vf", ",".join(video_filters)])

        # Codec & format configurations
        fmt = target_format.lower()
        if fmt == "mp4":
            args.extend([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "22",
                "-c:a", "aac",
                "-b:a", audio_bitrate,
                "-movflags", "+faststart",
            ])
        elif fmt == "webm":
            args.extend([
                "-c:v", "libvpx-vp9",
                "-b:v", video_bitrate or "2000k",
                "-c:a", "libopus",
                "-b:a", audio_bitrate,
            ])
        elif fmt == "mkv":
            args.extend([
                "-c:v", "copy",
                "-c:a", "copy",
            ])

        args.append(str(output_file))

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err_msg = stderr.decode(errors="replace")[-500:]
            raise RuntimeError(f"FFmpeg transcode error: {err_msg}")

        return output_file

    async def extract_audio(
        self,
        input_file: Path,
        output_file: Path,
        target_format: str = "mp3",
        bitrate: str = "320k",
        sample_rate: int = 44100
    ) -> Path:
        """
        Extracts and transcodes audio to MP3, M4A, WAV, FLAC, AAC, or Opus.
        """
        output_file.parent.mkdir(parents=True, exist_ok=True)
        args = [
            self.ffmpeg_bin,
            "-y",
            "-i", str(input_file),
            "-vn",  # No video
        ]

        fmt = target_format.lower()
        if fmt == "mp3":
            args.extend(["-c:a", "libmp3lame", "-b:a", bitrate, "-ar", str(sample_rate)])
        elif fmt == "m4a" or fmt == "aac":
            args.extend(["-c:a", "aac", "-b:a", bitrate, "-ar", str(sample_rate)])
        elif fmt == "flac":
            args.extend(["-c:a", "flac", "-ar", str(sample_rate)])
        elif fmt == "wav":
            args.extend(["-c:a", "pcm_s16le", "-ar", str(sample_rate)])
        elif fmt == "opus":
            args.extend(["-c:a", "libopus", "-b:a", bitrate, "-ar", str(sample_rate)])
        else:
            args.extend(["-c:a", "libmp3lame", "-b:a", bitrate])

        args.append(str(output_file))

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err_msg = stderr.decode(errors="replace")[-500:]
            raise RuntimeError(f"FFmpeg audio extraction error: {err_msg}")

        return output_file

    async def merge_video_audio(
        self,
        video_file: Path,
        audio_file: Path,
        output_file: Path
    ) -> Path:
        """
        Muxes separate video and audio files into a single container without re-encoding when possible.
        """
        output_file.parent.mkdir(parents=True, exist_ok=True)
        args = [
            self.ffmpeg_bin,
            "-y",
            "-i", str(video_file),
            "-i", str(audio_file),
            "-c:v", "copy",
            "-c:a", "aac",
            "-movflags", "+faststart",
            str(output_file)
        ]

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err_msg = stderr.decode(errors="replace")[-500:]
            raise RuntimeError(f"FFmpeg muxing error: {err_msg}")

        return output_file


ffmpeg_service = FFmpegService()
