import asyncio
import os
import imageio_ffmpeg
from typing import Optional, Dict, Any, Callable

class FFmpegService:
    def __init__(self):
        self.ffmpeg_binary = self._find_ffmpeg()

    def _find_ffmpeg(self) -> str:
        try:
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"

    async def convert_media(
        self,
        input_path: str,
        output_path: str,
        target_format: str,
        vcodec: Optional[str] = None,
        acodec: Optional[str] = None,
        video_bitrate: Optional[str] = None,
        audio_bitrate: Optional[str] = None,
        resolution: Optional[str] = None,
        fps: Optional[float] = None,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> str:
        """
        Converts media using FFmpeg with structured safe arguments.
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Fichier d'entrée introuvable: {input_path}")

        args = [self.ffmpeg_binary, "-y", "-i", input_path]

        # Audio conversion presets
        if target_format.lower() in ["mp3", "m4a", "wav", "flac", "aac", "opus"]:
            args.extend(["-vn"])  # Disable video
            if target_format == "mp3":
                args.extend(["-c:a", acodec or "libmp3lame"])
            elif target_format == "m4a" or target_format == "aac":
                args.extend(["-c:a", acodec or "aac"])
            elif target_format == "flac":
                args.extend(["-c:a", "flac"])
            elif target_format == "wav":
                args.extend(["-c:a", "pcm_s16le"])
            elif target_format == "opus":
                args.extend(["-c:a", "libopus"])

            if audio_bitrate:
                args.extend(["-b:a", audio_bitrate])

        # Video conversion presets
        elif target_format.lower() in ["mp4", "webm", "mkv"]:
            if vcodec:
                args.extend(["-c:v", vcodec])
            else:
                if target_format == "mp4":
                    args.extend(["-c:v", "libx264"])
                elif target_format == "webm":
                    args.extend(["-c:v", "libvpx-vp9"])

            if acodec:
                args.extend(["-c:a", acodec])

            if video_bitrate:
                args.extend(["-b:v", video_bitrate])
            if audio_bitrate:
                args.extend(["-b:a", audio_bitrate])

            if resolution:
                args.extend(["-vf", f"scale={resolution}"])
            if fps:
                args.extend(["-r", str(fps)])

        args.append(output_path)

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err_msg = stderr.decode('utf-8', errors='ignore')
            raise RuntimeError(f"Échec de la conversion FFmpeg: {err_msg[:300]}")

        return output_path

    async def merge_video_audio(
        self,
        video_path: str,
        audio_path: str,
        output_path: str
    ) -> str:
        """
        Merges separate video and audio streams into one container.
        """
        args = [
            self.ffmpeg_binary,
            "-y",
            "-i", video_path,
            "-i", audio_path,
            "-c:v", "copy",
            "-c:a", "aac",
            output_path
        ]

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err_msg = stderr.decode('utf-8', errors='ignore')
            raise RuntimeError(f"Échec de la fusion FFmpeg: {err_msg[:300]}")

        return output_path

ffmpeg_service = FFmpegService()
