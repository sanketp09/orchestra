"""
Real video frame extraction using opencv-python. This is genuine computation —
not a mock — and is meant to run against actual .mp4/.mov files.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)

MAX_FRAME_DIMENSION = 1024


@dataclass
class SampledFrame:
    frame_number: int
    timestamp_seconds: float
    image: np.ndarray  # BGR, resized


def _resize_to_max_dimension(frame: np.ndarray, max_dim: int = MAX_FRAME_DIMENSION) -> np.ndarray:
    """Resize so the longest side is at most max_dim, preserving aspect ratio.

    Keeps vision-API payload size (and therefore cost) bounded regardless of
    the source video's native resolution.
    """
    height, width = frame.shape[:2]
    longest_side = max(height, width)
    if longest_side <= max_dim:
        return frame
    scale = max_dim / float(longest_side)
    new_size = (int(width * scale), int(height * scale))
    return cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)


def extract_frames(
    video_path: str,
    interval_seconds: float = 2.0,
    max_frames: int = 20,
) -> list[SampledFrame]:
    """
    Sample frames from a video at a fixed time interval.

    Args:
        video_path: path to a .mp4/.mov (or any codec OpenCV can decode).
        interval_seconds: how far apart (in video time) sampled frames should be.
        max_frames: hard cap on frames returned, regardless of video length.
                    Protects against runaway API calls (and cost) if someone
                    uploads a long video, especially mid-demo.

    Returns:
        List of SampledFrame, each resized to at most MAX_FRAME_DIMENSION on
        its longest side.

    Raises:
        FileNotFoundError: if the video can't be opened at all.
        ValueError: if the video reports zero/invalid FPS (corrupt file).
    """
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise FileNotFoundError(f"Could not open video file: {video_path}")

    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0:
            raise ValueError(f"Video reports invalid FPS ({fps}); file may be corrupt: {video_path}")

        frame_interval = max(1, round(fps * interval_seconds))

        sampled: list[SampledFrame] = []
        frame_index = 0

        while True:
            ret, frame = capture.read()
            if not ret:
                break

            if frame_index % frame_interval == 0:
                resized = _resize_to_max_dimension(frame)
                timestamp = frame_index / fps
                sampled.append(
                    SampledFrame(
                        frame_number=len(sampled),
                        timestamp_seconds=round(timestamp, 2),
                        image=resized,
                    )
                )
                if len(sampled) >= max_frames:
                    logger.info(
                        "Hit max_frames cap (%d) while sampling %s; stopping early.",
                        max_frames,
                        video_path,
                    )
                    break

            frame_index += 1

        if not sampled:
            raise ValueError(f"No frames could be read from video: {video_path}")

        return sampled
    finally:
        capture.release()


def frame_to_jpeg_bytes(frame: np.ndarray, quality: int = 85) -> bytes:
    """Encode a BGR frame to JPEG bytes, ready for base64 + a vision API call."""
    success, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not success:
        raise ValueError("Failed to encode frame as JPEG")
    return buffer.tobytes()
