"""
Generates tests/fixtures/site_walk_sample.mp4 — a short synthetic clip used
only to exercise the real opencv frame-extraction path in
test_site_walk.py. It's not a real construction-site recording; it just needs
to be a valid, decodable video file of the right rough length.
"""

import os

import cv2
import numpy as np

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "site_walk_sample.mp4")


def generate(duration_seconds: int = 12, fps: int = 10, width: int = 640, height: int = 480):
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(OUTPUT_PATH, fourcc, fps, (width, height))

    total_frames = duration_seconds * fps
    for i in range(total_frames):
        frame = np.full((height, width, 3), 40, dtype=np.uint8)
        # Slowly moving rectangle so consecutive sampled frames differ slightly.
        x = int((i / total_frames) * (width - 100))
        cv2.rectangle(frame, (x, 150), (x + 100, 300), (60, 140, 60), -1)
        cv2.putText(
            frame, f"frame {i}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2
        )
        writer.write(frame)

    writer.release()
    print(f"Wrote {OUTPUT_PATH} ({total_frames} frames at {fps}fps)")


if __name__ == "__main__":
    generate()
