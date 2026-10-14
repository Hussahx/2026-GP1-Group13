"""
Rasid ground station - Step 5a: event manager
=============================================
Turns "boxes in many frames" into "ONE detection per person".

The model has no memory: it sees each frame on its own. The tracker gives a
person the same ID while they stay visible. This file adds the rules on top:

  Layer 2 - re-linking:
      a new track that appears soon after an old one vanished, close to where the
      old one was last seen in the image, is treated as the SAME person
      (people get new track IDs when the model misses them for a few frames).

  Layer 3 - confirmation:
      a track only becomes a Detection (saved + notified) when it was seen in at
      least MIN_HITS frames AND reached ALERT_CONF at least once. One-frame
      flickers never alert. The video still shows every box from 0.094.

For each detection we keep the frame where the person was seen MOST CLEARLY
(highest confidence): its clean image, box and the drone's GPS at that moment
(Level 1 location = drone position).

Result: two kinds of events for storage.py
    ("new", detection)     a new person was found        -> create in Firestore + notify
    ("update", detection)  a clearer view of that person -> replace image/confidence
"""

import time
import uuid
from dataclasses import dataclass, field

# ---- tunable rules ------------------------------------------------------
ALERT_CLASSES = {"person"}   # only people create alerts (cars/motos are shown on video only)
MIN_HITS = 3                 # frames a track must be seen in before it counts
ALERT_CONF = 0.25            # confidence it must reach at least once
RELINK_SECONDS = 8.0         # a "new" person within this time after one vanished...
RELINK_DIST = 0.12           # ...and this close (fraction of image width) = same person
UPDATE_MIN_GAIN = 0.10       # send an update only if confidence improved this much
UPDATE_MIN_INTERVAL = 5.0    # and at most every 5 s per detection


@dataclass
class TrackState:
    track_id: int
    cls: str
    first_seen: float
    last_seen: float
    hits: int = 0
    best_conf: float = 0.0
    best_box: list = None
    best_center: tuple = None
    best_image: object = None        # clean frame (numpy) of the best view
    best_telemetry: object = None
    last_center: tuple = None
    detection_id: str = None         # set once confirmed / linked


@dataclass
class DetectionEvent:
    id: str
    report_id: str
    mission_id: str
    cls: str
    conf: float
    box: list
    image: object
    telemetry: object
    track_ids: list = field(default_factory=list)
    hits: int = 0
    created_at: float = 0.0
    last_seen: float = 0.0
    last_center: tuple = None
    last_update_sent: float = 0.0
    sent_conf: float = 0.0


def _center(box):
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def _dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


class EventManager:
    def __init__(self, report_id, mission_id):
        self.report_id, self.mission_id = report_id, mission_id
        self.tracks = {}          # track_id -> TrackState
        self.detections = {}      # detection_id -> DetectionEvent

    def update(self, frame, dets, now=None):
        """Feed one frame + its detections. Returns a list of ("new"|"update", DetectionEvent)."""
        now = time.monotonic() if now is None else now
        events = []
        for d in dets:
            if d["cls"] not in ALERT_CLASSES or d["track_id"] is None:
                continue
            t = self._track(d, now)
            t.hits += 1
            t.last_seen = now
            t.last_center = _center(d["box"])
            if d["conf"] > t.best_conf:                       # clearer view of this person
                t.best_conf, t.best_box, t.best_center = d["conf"], d["box"], t.last_center
                t.best_image, t.best_telemetry = frame.image, frame.telemetry

            if t.detection_id is None:
                if t.hits >= MIN_HITS and t.best_conf >= ALERT_CONF:
                    events += self._confirm(t, now)
            else:
                events += self._maybe_update(t, now)
            if t.detection_id:
                self.detections[t.detection_id].last_seen = now
                self.detections[t.detection_id].last_center = t.last_center
                self.detections[t.detection_id].hits += 1
        self._forget_old(now)
        return events

    def detection_id_for(self, track_id):
        t = self.tracks.get(track_id)
        return t.detection_id if t else None

    # ------------------------------------------------------------ internals
    def _track(self, d, now):
        t = self.tracks.get(d["track_id"])
        if t is None:
            t = TrackState(d["track_id"], d["cls"], first_seen=now, last_seen=now)
            self.tracks[d["track_id"]] = t
        return t

    def _confirm(self, t, now):
        # Layer 2: is this someone we already reported who just got a new track ID?
        best, best_d = None, RELINK_DIST
        active_ids = {x.detection_id for x in self.tracks.values()
                      if x is not t and x.detection_id and now - x.last_seen < 0.5}
        for det in self.detections.values():
            if det.cls != t.cls or det.id in active_ids:      # that person is visible right now = different person
                continue
            if now - det.last_seen > RELINK_SECONDS or det.last_center is None:
                continue
            dd = _dist(det.last_center, t.best_center)
            if dd < best_d:
                best, best_d = det, dd
        if best is not None:
            t.detection_id = best.id
            best.track_ids.append(t.track_id)
            return self._maybe_update(t, now)

        det = DetectionEvent(id=uuid.uuid4().hex[:16], report_id=self.report_id, mission_id=self.mission_id,
                             cls=t.cls, conf=t.best_conf, box=t.best_box, image=t.best_image,
                             telemetry=t.best_telemetry, track_ids=[t.track_id], hits=t.hits,
                             created_at=now, last_seen=now, last_center=t.last_center,
                             last_update_sent=now, sent_conf=t.best_conf)
        self.detections[det.id] = det
        t.detection_id = det.id
        return [("new", det)]

    def _maybe_update(self, t, now):
        det = self.detections[t.detection_id]
        if t.best_conf >= det.sent_conf + UPDATE_MIN_GAIN and now - det.last_update_sent >= UPDATE_MIN_INTERVAL:
            det.conf, det.box, det.image, det.telemetry = t.best_conf, t.best_box, t.best_image, t.best_telemetry
            det.sent_conf, det.last_update_sent = t.best_conf, now
            return [("update", det)]
        return []

    def _forget_old(self, now):
        for tid in [k for k, t in self.tracks.items() if now - t.last_seen > RELINK_SECONDS * 2]:
            del self.tracks[tid]