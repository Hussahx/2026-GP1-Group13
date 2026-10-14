"""
Rasid ground station - Step 2: AU-AIR loader
============================================
Reads AU-AIR's annotations.json and turns it into "flights": the frames of one
drone video in the right order, each with the drone's telemetry at that moment.
This is what our fake drone (frame_source.py) will replay as a live stream.

What we learned about AU-AIR's annotation file:
  - 32,823 frames from 12 videos. The video is in the file name:
        frame_20190829091111_x_0001973.jpg
              └ video start ┘ └┘ └ frame index (5 frames per second)
    "x" and "xx" are two different videos that started at the same second.
  - time: date + h/min/sec = when the VIDEO started; "ms" = milliseconds since
    the video started. So real frame time = start + ms.
  - "longtitude" is misspelled in the dataset (kept as-is when reading).
  - altitude is in MILLIMETRES (19921.6 -> 19.9 m).
  - angle_phi / angle_theta / angle_psi = roll / pitch / yaw in radians.
  - bbox: top/left/height/width in pixels, class index into:
        0 Human, 1 Car, 2 Truck, 3 Van, 4 Motorbike, 5 Bicycle, 6 Bus, 7 Trailer

Folder layout expected (both git-ignored):
    ground_station/data/auair/annotations.json
    ground_station/data/auair/images/<flight_id>/frame_....jpg

Try it:
    python auair_loader.py                                  list all flights
    python auair_loader.py --flight 20190829091111_x        details + image check
    python auair_loader.py --extract "C:\\path\\auair2019data.zip"
        -> copies ONLY the demo flight's frames out of the 2 GB zip (no full unzip).
           Add --flight <id> to extract a different flight.
"""

import argparse
import json
import math
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data" / "auair"
ANNOTATIONS = DATA_DIR / "annotations.json"
IMAGES_DIR = DATA_DIR / "images"

AUAIR_CLASSES = ["Human", "Car", "Truck", "Van", "Motorbike", "Bicycle", "Bus", "Trailer"]
# AU-AIR class -> Rasid class (only the 3 our model knows; used later to compare)
TO_RASID = {"Human": "person", "Car": "car", "Motorbike": "moto"}

NAME_RE = re.compile(r"frame_(\d{14})_(x+)_(\d+)\.jpg$")
DENMARK_TZ = timezone(timedelta(hours=2))   # recorded Aug/Sep 2019 in Aarhus (CEST)

# Default demo flight: the one with the most frames containing people
DEFAULT_FLIGHT = "20190829091111_x"


@dataclass
class Telemetry:
    """Drone state for ONE frame. Same fields a real drone would give us."""
    time: datetime          # when the frame was captured
    lat: float              # degrees
    lng: float              # degrees
    alt_m: float            # metres
    roll_deg: float
    pitch_deg: float
    yaw_deg: float          # heading (0-360)
    vx: float               # m/s
    vy: float
    vz: float

    def to_dict(self):
        return {"time": self.time.isoformat(), "lat": self.lat, "lng": self.lng,
                "alt": round(self.alt_m, 1), "yaw": round(self.yaw_deg, 1),
                "roll": round(self.roll_deg, 1), "pitch": round(self.pitch_deg, 1),
                "speed": round(math.sqrt(self.vx ** 2 + self.vy ** 2), 2)}


@dataclass
class FrameInfo:
    image_name: str
    index: int                      # frame number inside the video
    telemetry: Telemetry
    gt_boxes: list = field(default_factory=list)   # AU-AIR's own labels (for evaluation only)


@dataclass
class Flight:
    flight_id: str                  # e.g. "20190829091111_x"
    frames: list                    # FrameInfo, in order

    @property
    def start(self):
        return self.frames[0].telemetry.time

    @property
    def duration_s(self):
        return (self.frames[-1].telemetry.time - self.start).total_seconds()

    def people_frames(self):
        return sum(1 for f in self.frames if any(b["class"] == "Human" for b in f.gt_boxes))


def _parse(a):
    m = NAME_RE.match(a["image_name"])
    if not m:
        return None
    start_str, xs, idx = m.groups()
    t = a["time"]
    start = datetime(t["year"], t["month"], t["day"], t["hour"], t["min"], t["sec"], tzinfo=DENMARK_TZ)
    tel = Telemetry(
        time=start + timedelta(milliseconds=t.get("ms", 0.0)),
        lat=a["latitude"],
        lng=a.get("longtitude", a.get("longitude")),          # dataset typo
        alt_m=a["altitude"] / 1000.0,                          # mm -> m
        roll_deg=math.degrees(a["angle_phi"]),
        pitch_deg=math.degrees(a["angle_theta"]),
        yaw_deg=math.degrees(a["angle_psi"]) % 360,
        vx=a["linear_x"], vy=a["linear_y"], vz=a["linear_z"])
    boxes = [{"class": AUAIR_CLASSES[b["class"]],
              "xyxy": [b["left"], b["top"], b["left"] + b["width"], b["top"] + b["height"]]}
             for b in a.get("bbox", [])]
    return f"{start_str}_{xs}", FrameInfo(a["image_name"], int(idx), tel, boxes)


def load_flights(annotations=ANNOTATIONS):
    """Return {flight_id: Flight} with frames sorted by frame index."""
    with open(annotations, encoding="utf-8") as f:
        data = json.load(f)
    flights = {}
    for a in data["annotations"]:
        parsed = _parse(a)
        if parsed:
            fid, fi = parsed
            flights.setdefault(fid, []).append(fi)
    return {fid: Flight(fid, sorted(frs, key=lambda x: x.index)) for fid, frs in flights.items()}


def index_images(images_dir=IMAGES_DIR):
    """Map image file name -> full path (works whatever the sub-folder layout is)."""
    if not images_dir.exists():
        return {}
    return {p.name: p for p in images_dir.rglob("*.jpg")}


def extract_flight(zip_path, flight, images_dir=IMAGES_DIR):
    """Copy only one flight's frames out of the big AU-AIR zip (reads the zip
    directly, so the 2 GB never has to be unzipped)."""
    wanted = {f.image_name for f in flight.frames}
    out_dir = images_dir / flight.flight_id
    out_dir.mkdir(parents=True, exist_ok=True)
    done = 0
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            name = Path(info.filename).name
            if name in wanted:
                target = out_dir / name
                if not target.exists():
                    target.write_bytes(z.read(info))
                done += 1
                if done % 250 == 0:
                    print(f"  {done}/{len(wanted)} frames...")
    size_mb = sum(p.stat().st_size for p in out_dir.glob("*.jpg")) / 1e6
    print(f"Extracted {done}/{len(wanted)} frames -> {out_dir} ({size_mb:.0f} MB)")
    if done < len(wanted):
        print("! Some frames were not found in the zip - send me this output.")


def _metres(lat1, lng1, lat2, lng2):
    dy = (lat2 - lat1) * 111_320
    dx = (lng2 - lng1) * 111_320 * math.cos(math.radians(lat1))
    return math.hypot(dx, dy)


def main():
    ap = argparse.ArgumentParser(description="AU-AIR flights overview")
    ap.add_argument("--annotations", type=Path, default=ANNOTATIONS)
    ap.add_argument("--images", type=Path, default=IMAGES_DIR)
    ap.add_argument("--flight", type=str, default=None, help="show details for one flight")
    ap.add_argument("--extract", type=Path, default=None, metavar="ZIP",
                    help="path to auair2019data.zip: extract one flight's frames (default: demo flight)")
    args = ap.parse_args()

    if not args.annotations.exists():
        raise SystemExit(f"Not found: {args.annotations}\nUnzip auair2019annotations.zip into ground_station/data/auair/")

    flights = load_flights(args.annotations)

    if args.extract:
        fid = args.flight or DEFAULT_FLIGHT
        if fid not in flights:
            raise SystemExit(f"Unknown flight {fid}")
        print(f"Extracting flight {fid} from {args.extract} ...")
        extract_flight(args.extract, flights[fid], args.images)
        args.flight = fid                     # show the details/check below
        print()
    print(f"{len(flights)} flights, {sum(len(f.frames) for f in flights.values())} frames\n")
    print(f"{'flight':<20}{'frames':>7}{'minutes':>9}{'w/ people':>11}{'alt m':>12}")
    for f in sorted(flights.values(), key=lambda f: -f.people_frames()):
        alts = [x.telemetry.alt_m for x in f.frames]
        mark = "  <- default demo" if f.flight_id == DEFAULT_FLIGHT else ""
        print(f"{f.flight_id:<20}{len(f.frames):>7}{f.duration_s / 60:>9.1f}{f.people_frames():>11}"
              f"{min(alts):>6.0f}-{max(alts):<5.0f}{mark}")

    if args.flight:
        f = flights.get(args.flight)
        if not f:
            raise SystemExit(f"\nNo flight called {args.flight}")
        tel = [x.telemetry for x in f.frames]
        far = max(_metres(tel[0].lat, tel[0].lng, t.lat, t.lng) for t in tel)
        print(f"\nFlight {f.flight_id}")
        print(f"  start      : {f.start:%Y-%m-%d %H:%M:%S} (Aarhus, Denmark)")
        print(f"  duration   : {f.duration_s / 60:.1f} min, {len(f.frames)} frames")
        print(f"  first GPS  : {tel[0].lat:.6f}, {tel[0].lng:.6f}")
        print(f"  max distance from start: {far:.0f} m")
        imgs = index_images(args.images)
        if not imgs:
            print(f"  images     : none found in {args.images} (unzip auair2019data.zip there)")
        else:
            found = sum(1 for x in f.frames if x.image_name in imgs)
            print(f"  images     : {found}/{len(f.frames)} found on disk")


if __name__ == "__main__":
    main()