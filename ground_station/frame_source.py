"""
Rasid ground station - Step 3a: frame sources ("the drone")
===========================================================
A FrameSource is anything that gives us frames one by one, each with the drone's
telemetry (GPS, altitude, heading...). Everything after this file (detector,
server, website) only sees Frame objects, so it does not care whether they come
from AU-AIR, a video file, or a real drone.

    AuAirSource   replays one AU-AIR flight at its real speed (5 fps)   <- now
    VideoSource   a video file + a GPS track (our own desert simulation) <- later
    DroneSource   a real drone's live feed                               <- future work

Real-time rule (like a real drone): frames keep coming at 5 fps whether or not we
are ready. If the detector is slower than 0.2 s on a frame, the frames that were
"filmed" meanwhile are skipped, so the stream never falls behind real time.
"""

import time
from dataclasses import dataclass

import cv2
import numpy as np

from auair_loader import ANNOTATIONS, DEFAULT_FLIGHT, IMAGES_DIR, Telemetry, index_images, load_flights


@dataclass
class Frame:
    image: np.ndarray        # BGR image (OpenCV format)
    telemetry: Telemetry     # drone state when this frame was captured
    number: int              # position in the stream (0, 1, 2, ...)
    source: str              # e.g. "AU-AIR 20190829091111_x"
    name: str = ""           # original file name (AU-AIR frames)


class FrameSource:
    """Base class: iterate over it to get Frame objects."""
    fps = 5.0
    name = "source"

    def __iter__(self):
        raise NotImplementedError

    def __len__(self):
        return 0


class AuAirSource(FrameSource):
    def __init__(self, flight_id=DEFAULT_FLIGHT, fps=5.0, realtime=True, start=0, loop=False):
        """
        flight_id : which AU-AIR flight to replay
        fps       : stream speed (AU-AIR frames were sampled at 5 fps)
        realtime  : True  = behave like a live drone (wait between frames, skip late ones)
                    False = give frames as fast as possible (for testing/evaluation)
        start     : frame position to start from (e.g. jump to where people appear)
        loop      : start again from the beginning when the flight ends
        """
        flights = load_flights(ANNOTATIONS)
        if flight_id not in flights:
            raise ValueError(f"Unknown flight {flight_id}")
        images = index_images(IMAGES_DIR)
        self.frames = [f for f in flights[flight_id].frames if f.image_name in images][start:]
        if not self.frames:
            raise FileNotFoundError(f"No images of {flight_id} in {IMAGES_DIR}. "
                                    f"Run: python auair_loader.py --extract <zip>")
        self.paths = images
        self.flight_id, self.fps, self.realtime, self.loop = flight_id, fps, realtime, loop
        self.name = f"AU-AIR {flight_id}"
        self.skipped = 0            # frames dropped because we were too slow

    def __len__(self):
        return len(self.frames)

    def __iter__(self):
        number = 0
        while True:
            t0 = time.perf_counter()
            i = 0
            while i < len(self.frames):
                if self.realtime:
                    due = t0 + i / self.fps                   # when this frame is "filmed"
                    now = time.perf_counter()
                    if now < due:
                        time.sleep(due - now)
                    else:
                        late = int((now - due) * self.fps)    # frames filmed while we were busy
                        if late > 0:
                            self.skipped += late
                            i += late
                            if i >= len(self.frames):
                                break
                info = self.frames[i]
                img = cv2.imread(str(self.paths[info.image_name]))
                if img is not None:
                    yield Frame(img, info.telemetry, number, self.name, info.image_name)
                    number += 1
                i += 1
            if not self.loop:
                return