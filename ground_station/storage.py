"""
Rasid ground station - Step 5b: storage
=======================================
Saves detections so every volunteer sees them (not only people watching the video).

  image  -> Cloudinary   (same account + unsigned preset the website uses for evidence,
                          folder "detections")
  record -> Firestore    collection "Detection" (one document per person found)
            Firestore    collection "VideoRecording" (one document per drone mission)

Uploads run in a background thread, so a slow internet connection never slows
down the live video or the model.

Needs ground_station/serviceAccountKey.json (Firebase private key, git-ignored).
Without it the ground station still works, it just prints detections instead of saving.
"""

import queue
import threading
from datetime import datetime, timezone
from pathlib import Path

import cv2
import requests

HERE = Path(__file__).resolve().parent
KEY_PATH = HERE / "serviceAccountKey.json"
CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dtihhz1l4/image/upload"
CLOUDINARY_PRESET = "x1kwhu9q"          # same unsigned preset as JS/index.js
CLOUDINARY_FOLDER = "detections"
LABELS_AR = {"person": "شخص", "car": "سيارة", "moto": "دراجة نارية"}


class Storage:
    def __init__(self):
        self.db = None
        self.enabled = False
        self.jobs = queue.Queue()
        self.saved = 0
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            if not KEY_PATH.exists():
                raise FileNotFoundError(f"{KEY_PATH.name} not found")
            if not firebase_admin._apps:
                firebase_admin.initialize_app(credentials.Certificate(str(KEY_PATH)))
            self.db = firestore.client()
            self._fs = firestore
            self.enabled = True
            print("Storage: Firestore + Cloudinary ready.")
        except Exception as e:
            print(f"Storage: DISABLED ({e}). Detections will only be printed.")
        threading.Thread(target=self._worker, daemon=True).start()

    # ------------------------------------------------------------ public API
    def mission_started(self, info):
        self.jobs.put(("mission_start", dict(info)))

    def mission_ended(self, info, frames, detections):
        self.jobs.put(("mission_end", dict(info, frames=frames, detections=detections)))

    def save(self, kind, det):
        """kind = "new" or "update". The image is encoded NOW (the frame may change later)."""
        ok, buf = cv2.imencode(".jpg", det.image, [cv2.IMWRITE_JPEG_QUALITY, 88])
        h, w = det.image.shape[:2]
        record = {
            "DetectionID": det.id,
            "ReportID": det.report_id,
            "VideoID": det.mission_id,
            "Class": det.cls,
            "ClassAr": LABELS_AR.get(det.cls, det.cls),
            "ConfidenceScore": round(float(det.conf), 3),
            "Latitude": det.telemetry.lat,
            "Longitude": det.telemetry.lng,
            "DroneAltitude": round(det.telemetry.alt_m, 1),
            "DroneHeading": round(det.telemetry.yaw_deg, 1),
            "FrameTime": det.telemetry.time.isoformat(),
            "BBox": [round(float(v), 4) for v in det.box],          # x1,y1,x2,y2 as 0-1 of the image
            "ImageWidth": w, "ImageHeight": h,
            "TrackIDs": list(det.track_ids),
            "LocationMethod": "drone_gps",                          # Level 1: drone position at that frame
        }
        print(f"[detection] {kind.upper():6s} {det.cls} {det.conf:.2f} "
              f"GPS {det.telemetry.lat:.6f},{det.telemetry.lng:.6f} (id {det.id})")
        self.jobs.put((kind, (record, buf.tobytes() if ok else None)))

    # ------------------------------------------------------------ worker
    def _worker(self):
        while True:
            kind, data = self.jobs.get()
            if not self.enabled:
                continue
            try:
                if kind == "mission_start":
                    self._mission_start(data)
                elif kind == "mission_end":
                    self._mission_end(data)
                else:
                    self._save(kind, *data)
            except Exception as e:
                print(f"[storage] {kind} failed: {type(e).__name__}: {e}")

    def _upload(self, jpg, public_id):
        r = requests.post(CLOUDINARY_URL, timeout=30,
                          data={"upload_preset": CLOUDINARY_PRESET, "folder": CLOUDINARY_FOLDER,
                                "public_id": public_id},
                          files={"file": (f"{public_id}.jpg", jpg, "image/jpeg")})
        r.raise_for_status()
        return r.json()["secure_url"]

    def _save(self, kind, record, jpg):
        ref = self.db.collection("Detection").document(record["DetectionID"])
        if jpg:
            # unsigned uploads cannot overwrite, so every version gets its own name
            version = datetime.now().strftime("%H%M%S")
            record["DetectionImage"] = self._upload(jpg, f"{record['DetectionID']}_{version}")
        record["GPSLocation"] = self._fs.GeoPoint(record["Latitude"], record["Longitude"])
        record["UpdatedAt"] = self._fs.SERVER_TIMESTAMP
        if kind == "new":
            record.update(TimeStamp=self._fs.SERVER_TIMESTAMP, Status="new", Source="AU-AIR simulation")
            ref.set(record)
        else:
            ref.set(record, merge=True)          # keeps Status if a volunteer already changed it
        self.saved += 1

    def _mission_start(self, info):
        self.db.collection("VideoRecording").document(info["missionId"]).set({
            "VideoID": info["missionId"], "ReportID": info["reportId"],
            "VideoName": info.get("flight"), "Source": info.get("source", "AU-AIR simulation"),
            "VideoDate": datetime.now(timezone.utc).date().isoformat(),
            "StartedAt": self._fs.SERVER_TIMESTAMP, "Status": "running"})

    def _mission_end(self, info):
        self.db.collection("VideoRecording").document(info["missionId"]).set({
            "EndedAt": self._fs.SERVER_TIMESTAMP, "Status": "ended",
            "FramesProcessed": info["frames"], "DetectionsCount": info["detections"]}, merge=True)