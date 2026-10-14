"""
Rasid ground station - Step 4: server
=====================================
Connects the drone + model to the website.

    FrameSource -> Detector -> [this server] --WebSocket--> RealTimeReportDetails.html

What it does:
  - loads the model ONCE at start-up (and warms it up)
  - runs a "mission": replays a flight through the detector in a background thread
  - streams every processed frame to the website over a WebSocket:
        { type: "frame", reportId, image (JPEG), telemetry (GPS...), boxes, stats }
  - tells the website when there is no active drone (type: "status")

Run (from inside ground_station):
    python server.py --report <Firestore docId of the report>
        -> starts the mission for that report right away
    python server.py
        -> starts idle; start a mission later with POST /mission/start

Endpoints:
    GET  /health                    is the server up? is a mission running?
    POST /mission/start             {"reportId": "...", "flight": "...", "start": 0}
    POST /mission/stop
    WS   /ws/stream                 the live stream (used by JS/droneStream.js)
"""

import argparse
import asyncio
import base64
import json
import threading
import time
import uuid
from contextlib import asynccontextmanager

import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from auair_loader import DEFAULT_FLIGHT
from detector import Detector
from event_manager import EventManager
from frame_source import AuAirSource
from storage import Storage

STREAM_WIDTH = 960           # frames are shrunk to this width for the browser (smaller = faster)
JPEG_QUALITY = 70
TIMING_EVERY = 50            # print a timing line every N frames


class Mission:
    """One drone mission = one flight streamed for one report. Runs in its own thread."""

    def __init__(self):
        self.detector = None
        self.storage = None
        self.thread = None
        self.stop_flag = threading.Event()
        self.lock = threading.Lock()
        self.state = "idle"                 # idle | starting | running | ended
        self.info = {}                      # missionId, reportId, source...
        self.latest = None                  # latest frame message (JSON text)
        self.seq = 0                        # increases with every new frame
        self.status_seq = 0                 # increases when state changes

    # ---------------------------------------------------------------- control
    def load_model(self):
        print("Loading model + warm-up (first time takes ~20 s)...")
        self.detector = Detector()
        self.detector.warmup()
        self.storage = Storage()
        print("Model ready.")

    def start(self, report_id, flight=DEFAULT_FLIGHT, start=0):
        self.stop()
        self.stop_flag.clear()
        self.detector.reset()                                   # fresh track IDs
        self.info = {"missionId": uuid.uuid4().hex[:12], "reportId": report_id,
                     "flight": flight, "startedAt": time.time()}
        self._set_state("starting")
        self.thread = threading.Thread(target=self._run, args=(flight, start), daemon=True)
        self.thread.start()
        return self.info

    def stop(self):
        if self.thread and self.thread.is_alive():
            self.stop_flag.set()
            self.thread.join(timeout=5)
        if self.state in ("starting", "running"):
            self._set_state("ended")

    def status_message(self):
        return json.dumps({"type": "status", "state": self.state, **self.info})

    # ---------------------------------------------------------------- the loop
    def _set_state(self, state):
        with self.lock:
            self.state = state
            self.status_seq += 1
        print(f"[mission] {state} {self.info.get('reportId', '')}")

    def _run(self, flight, start):
        try:
            source = AuAirSource(flight, realtime=True, start=start)
        except Exception as e:
            print(f"[mission] cannot start: {e}")
            self._set_state("ended")
            return
        self.info["source"] = source.name
        self.storage.mission_started(self.info)
        events = EventManager(self.info["reportId"], self.info["missionId"])
        self._set_state("running")
        t0, n = time.perf_counter(), 0
        sums = {"model": 0.0, "events": 0.0, "encode": 0.0, "loop": 0.0}
        for frame in source:
            if self.stop_flag.is_set():
                break
            t_loop = time.perf_counter()
            dets = self.detector.detect(frame.image)
            t_ev = time.perf_counter()
            for kind, det in events.update(frame, dets):          # one detection per person
                self.storage.save(kind, det)
            t_enc = time.perf_counter()
            image = self._encode(frame.image)
            t_end = time.perf_counter()
            n += 1
            msg = {
                "type": "frame",
                "missionId": self.info["missionId"],
                "reportId": self.info["reportId"],
                "source": source.name,
                "n": frame.number,
                "image": image,
                "telemetry": frame.telemetry.to_dict(),
                "boxes": [{"cls": d["cls"], "conf": d["conf"], "trackId": d["track_id"], "box": d["box"],
                           "detectionId": events.detection_id_for(d["track_id"])}
                          for d in dets],
                "stats": {"modelMs": round(self.detector.last_ms),
                          "skipped": source.skipped,
                          "detections": len(events.detections),
                          "fps": round(n / max(1e-6, time.perf_counter() - t0), 1)},
            }
            with self.lock:
                self.latest = json.dumps(msg)
                self.seq += 1
            for k, v in (("model", t_ev - t_loop), ("events", t_enc - t_ev), ("encode", t_end - t_enc),
                         ("loop", time.perf_counter() - t_loop)):
                sums[k] += v
            if n % TIMING_EVERY == 0:
                print(f"[timing] last {TIMING_EVERY} frames avg: model {1000*sums['model']/TIMING_EVERY:.0f} ms | "
                      f"events {1000*sums['events']/TIMING_EVERY:.0f} ms | encode {1000*sums['encode']/TIMING_EVERY:.0f} ms | "
                      f"total {1000*sums['loop']/TIMING_EVERY:.0f} ms (budget 200) | skipped so far {source.skipped} | "
                      f"detections {len(events.detections)}")
                sums = dict.fromkeys(sums, 0.0)
        self.storage.mission_ended(self.info, n, len(events.detections))
        self._set_state("ended")

    @staticmethod
    def _encode(image):
        h, w = image.shape[:2]
        if w > STREAM_WIDTH:
            image = cv2.resize(image, (STREAM_WIDTH, int(h * STREAM_WIDTH / w)), interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        return "data:image/jpeg;base64," + base64.b64encode(buf).decode("ascii")


mission = Mission()
AUTO_START = {}      # filled from the command line


@asynccontextmanager
async def lifespan(app):
    await asyncio.to_thread(mission.load_model)
    if AUTO_START.get("report"):
        mission.start(AUTO_START["report"], AUTO_START["flight"], AUTO_START["start"])
    yield
    mission.stop()


app = FastAPI(title="Rasid ground station", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class StartRequest(BaseModel):
    reportId: str
    flight: str = DEFAULT_FLIGHT
    start: int = 0


@app.get("/health")
def health():
    return {"ok": True, "state": mission.state, **mission.info}


@app.post("/mission/start")
def start_mission(req: StartRequest):
    return {"ok": True, **mission.start(req.reportId, req.flight, req.start)}


@app.post("/mission/stop")
def stop_mission():
    mission.stop()
    return {"ok": True, "state": mission.state}


@app.websocket("/ws/stream")
async def stream(ws: WebSocket):
    """Sends the newest frame whenever there is one. A slow browser simply
    skips frames instead of falling behind."""
    await ws.accept()
    sent_seq, sent_status = -1, -1
    try:
        while True:
            if mission.status_seq != sent_status:
                sent_status = mission.status_seq
                await ws.send_text(mission.status_message())
            if mission.seq != sent_seq and mission.latest is not None and mission.state == "running":
                with mission.lock:
                    sent_seq, text = mission.seq, mission.latest
                await ws.send_text(text)
            else:
                await asyncio.sleep(0.03)
    except (WebSocketDisconnect, RuntimeError):
        pass


if __name__ == "__main__":
    import uvicorn
    ap = argparse.ArgumentParser(description="Rasid ground station server")
    ap.add_argument("--report", default=None, help="Firestore docId of the report to start a mission for")
    ap.add_argument("--flight", default=DEFAULT_FLIGHT)
    ap.add_argument("--start", type=int, default=0, help="start at this frame of the flight")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    AUTO_START.update(report=args.report, flight=args.flight, start=args.start)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")