"""
Rasid ground station - Step 3b: detector
========================================
Runs our YOLO26s model (960 px) on each frame and TRACKS objects across frames,
so the same person keeps the same ID (track_id) while visible. The track ID is
what later lets us save ONE detection per person instead of one per frame.

Thresholds: per-class "rescue" thresholds from models/model_card.json
(person 0.094, car 0.05, moto 0.05), chosen on the validation set for high recall.

Preview (watch the model on the AU-AIR flight in a window):
    python detector.py                      the demo flight, real-time 5 fps
    python detector.py --start 600          start at frame 600
    python detector.py --fast               no waiting (as fast as the laptop can)
Keys in the window:  q = quit,  space = pause
"""

import json
import tempfile
import time
from pathlib import Path

import cv2

HERE = Path(__file__).resolve().parent
MODEL_PATH = HERE / "models" / "rasid_v3_yolo26s_960.pt"
MODEL_CARD = HERE / "models" / "model_card.json"
IMGSZ = 960
FALLBACK_THRESHOLDS = {"car": 0.05, "moto": 0.05, "person": 0.094}
COLORS = {"person": (0, 0, 255), "car": (255, 160, 0), "moto": (0, 200, 255)}   # BGR

# ByteTrack's defaults only START a track for detections >= 0.25 confidence.
# Our person threshold is 0.094 (rescue mode), so we lower it - otherwise faint
# people would be detected but never tracked (and never reported).
# fuse_score is OFF: when ON, a match needs IoU x confidence > 0.2, so any person
# below 0.2 confidence can never be matched to its track and is dropped after 1 frame.
TRACKER_CFG = """tracker_type: bytetrack
track_high_thresh: 0.09
track_low_thresh: 0.05
new_track_thresh: 0.09
track_buffer: 30
match_thresh: 0.8
fuse_score: False
"""


def load_thresholds():
    try:
        card = json.loads(MODEL_CARD.read_text(encoding="utf-8").replace("NaN", "null"))
        return {c: float(t["rescue"]) for c, t in card["thresholds"].items()}
    except Exception:
        return dict(FALLBACK_THRESHOLDS)


class Detector:
    def __init__(self, model_path=MODEL_PATH, imgsz=IMGSZ, thresholds=None, track=True):
        from ultralytics import YOLO
        self.model = YOLO(str(model_path), task="detect")
        self.names = self.model.names                      # {0: car, 1: moto, 2: person}
        self.imgsz, self.track = imgsz, track
        self.thresholds = thresholds or load_thresholds()
        self.min_conf = min(self.thresholds.values())
        self.tracker_yaml = Path(tempfile.gettempdir()) / "rasid_bytetrack.yaml"
        self.tracker_yaml.write_text(TRACKER_CFG)
        self.last_ms = 0.0

    def warmup(self):
        """The very first call is slow (loading, setting up the tracker), so do it
        once on a blank frame BEFORE the stream starts - otherwise the real-time
        source would skip many frames while waiting for it."""
        import numpy as np
        blank = np.zeros((1080, 1920, 3), dtype=np.uint8)
        for _ in range(2):
            self.detect(blank)
        self.reset()

    def reset(self):
        """Forget all tracks (call when a new mission/flight starts)."""
        if self.track and getattr(self.model, "predictor", None) is not None:
            for t in getattr(self.model.predictor, "trackers", []) or []:
                t.reset()

    def detect(self, image):
        """Return a list of detections for one BGR image:
           {track_id, cls, conf, xyxy (pixels), box (0-1, relative to image size)}"""
        t0 = time.perf_counter()
        kw = dict(imgsz=self.imgsz, conf=self.min_conf, verbose=False)
        if self.track:
            r = self.model.track(image, persist=True, tracker=str(self.tracker_yaml), **kw)[0]
        else:
            r = self.model.predict(image, **kw)[0]
        self.last_ms = (time.perf_counter() - t0) * 1000

        h, w = image.shape[:2]
        out = []
        b = r.boxes
        if b is None or len(b) == 0:
            return out
        ids = b.id.int().tolist() if b.id is not None else [None] * len(b)
        for xyxy, conf, c, tid in zip(b.xyxy.tolist(), b.conf.tolist(), b.cls.int().tolist(), ids):
            name = self.names[c]
            if conf < self.thresholds.get(name, 0.25):     # per-class rescue threshold
                continue
            x1, y1, x2, y2 = xyxy
            out.append({"track_id": tid, "cls": name, "conf": round(conf, 3),
                        "xyxy": [round(v, 1) for v in xyxy],
                        "box": [round(x1 / w, 4), round(y1 / h, 4), round(x2 / w, 4), round(y2 / h, 4)]})
        return out


def draw(image, detections):
    """Draw boxes on a COPY of the image (the original stays clean for saving)."""
    img = image.copy()
    lw = max(2, img.shape[1] // 640)
    for d in detections:
        x1, y1, x2, y2 = map(int, d["xyxy"])
        col = COLORS.get(d["cls"], (255, 255, 255))
        cv2.rectangle(img, (x1, y1), (x2, y2), col, lw)
        label = f"{d['cls']} {d['conf']:.2f}" + (f" #{d['track_id']}" if d["track_id"] is not None else "")
        cv2.putText(img, label, (x1, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5 * lw, col, lw)
    return img


# ------------------------------------------------------------------ preview
def preview():
    import argparse
    from frame_source import AuAirSource
    from auair_loader import DEFAULT_FLIGHT

    ap = argparse.ArgumentParser(description="Watch the model on an AU-AIR flight")
    ap.add_argument("--flight", default=DEFAULT_FLIGHT)
    ap.add_argument("--start", type=int, default=0, help="start at this frame")
    ap.add_argument("--fast", action="store_true", help="don't wait between frames")
    ap.add_argument("--no-track", action="store_true", help="detection only, no tracking")
    ap.add_argument("--max-frames", type=int, default=0, help="stop after N frames (0 = whole flight)")
    ap.add_argument("--headless", action="store_true", help="no window, print only (for testing)")
    args = ap.parse_args()

    source = AuAirSource(args.flight, realtime=not args.fast, start=args.start)
    det = Detector(track=not args.no_track)
    print("Warming up the model...")
    det.warmup()
    print(f"Source : {source.name} ({len(source)} frames)\nModel  : {MODEL_PATH.name} @ {IMGSZ}px")
    print(f"Thresholds: {det.thresholds}\nPress q in the window to quit.\n")

    people_ids, n, t_start, model_ms = set(), 0, time.perf_counter(), []
    for frame in source:
        dets = det.detect(frame.image)
        model_ms.append(det.last_ms)
        people = [d for d in dets if d["cls"] == "person"]
        people_ids.update(d["track_id"] for d in people if d["track_id"] is not None)
        n += 1
        tel = frame.telemetry
        if args.headless:
            if n % 10 == 0 or people:
                print(f"frame {frame.number:5d} | {det.last_ms:6.1f} ms | people {len(people)} | "
                      f"GPS {tel.lat:.6f},{tel.lng:.6f} alt {tel.alt_m:.1f} m")
        else:
            view = draw(frame.image, dets)
            info = [f"{frame.source}  frame {frame.number}",
                    f"GPS {tel.lat:.6f}, {tel.lng:.6f}   alt {tel.alt_m:.1f} m   heading {tel.yaw_deg:.0f}",
                    f"model {det.last_ms:.0f} ms | people now {len(people)} | unique people {len(people_ids)} | skipped {source.skipped}"]
            for k, line in enumerate(info):
                cv2.putText(view, line, (15, 35 + 32 * k), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 5)
                cv2.putText(view, line, (15, 35 + 32 * k), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
            cv2.imshow("Rasid - detector preview", cv2.resize(view, (1280, 720)))
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord(" "):
                cv2.waitKey(0)
        if args.max_frames and n >= args.max_frames:
            break

    secs = time.perf_counter() - t_start
    avg_model = sum(model_ms) / max(1, len(model_ms))
    print(f"\nShown {n} frames in {secs:.0f} s | skipped {source.skipped} (too slow) | "
          f"unique people tracked: {len(people_ids)}")
    print(f"Average per shown frame: model {avg_model:.0f} ms | per shown frame incl. reading, drawing, window, waiting "
          f"{1000 * secs / max(1, n):.0f} ms | budget 200 ms")
    cv2.destroyAllWindows()


if __name__ == "__main__":
    preview()