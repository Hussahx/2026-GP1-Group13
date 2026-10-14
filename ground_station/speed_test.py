"""
Rasid ground station - Step 1: speed test
=========================================
Question this script answers:
    Can THIS laptop run our detection model fast enough for a live drone stream?

The AU-AIR "drone" streams 5 frames per second, so the model has a budget of
200 ms per frame. This script times the model in several setups and tells you
which ones fit inside that budget.

Setups tested (each one is optional / skipped if not possible):
    1. PyTorch (.pt)   at 960 px   <- our final model, exactly as trained
    2. PyTorch (.pt)   at 640 px   <- same weights, smaller input (faster, less accurate on tiny people)
    3. ONNX            at 960 / 640 <- same model converted to a format that is faster on CPUs
    4. OpenVINO        at 960 / 640 <- Intel's format, usually the fastest on Intel laptops

How to run (from inside the ground_station folder):
    pip install -r requirements.txt
    python speed_test.py
    python speed_test.py --images path/to/some/drone/frames      (more realistic timing)
    python speed_test.py --skip-export                           (only test the .pt model)

Results are printed and saved to speed_results.csv.
"""

import argparse
import csv
import os
import platform
import statistics
import sys
import time
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
DEFAULT_MODEL = HERE / "models" / "rasid_v3_yolo26s_960.pt"
EXPORT_DIR = HERE / "models" / "exports"

STREAM_FPS = 5                         # AU-AIR frames are sampled at 5 fps
BUDGET_MS = 1000 / STREAM_FPS          # = 200 ms per frame
PERSON_CONF = 0.094                    # rescue threshold for "person" (model_card.json)


# ---------------------------------------------------------------- helpers
def device_info():
    """Return (device_string_for_ultralytics, human_readable_description)."""
    import torch
    if torch.cuda.is_available():
        return "0", f"NVIDIA GPU: {torch.cuda.get_device_name(0)}"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps", "Apple GPU (MPS)"
    cpu = platform.processor() or platform.machine()
    return "cpu", f"CPU only: {cpu} ({os.cpu_count()} logical cores)"


def load_frames(images_dir, n_max=20):
    """Real frames if a folder is given, otherwise one synthetic 1920x1080 frame.
    Inference time barely depends on image content, so the synthetic frame is
    fine for a first answer; real frames make it a bit more realistic."""
    if images_dir:
        exts = {".jpg", ".jpeg", ".png", ".bmp"}
        paths = sorted(p for p in Path(images_dir).iterdir() if p.suffix.lower() in exts)[:n_max]
        frames = [cv2.imread(str(p)) for p in paths]
        frames = [f for f in frames if f is not None]
        if frames:
            print(f"Using {len(frames)} real frames from {images_dir}")
            return frames
        print(f"! No readable images in {images_dir} - falling back to a synthetic frame")
    rng = np.random.default_rng(0)
    frame = rng.integers(90, 200, size=(1080, 1920, 3), dtype=np.uint8)  # sand-ish noise
    print("Using a synthetic 1920x1080 frame (pass --images for real drone frames)")
    return [frame]


def export(model_path, fmt, imgsz):
    """Export the .pt model to ONNX/OpenVINO once and reuse it on later runs."""
    from ultralytics import YOLO
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = {"onnx": ".onnx", "openvino": "_openvino_model"}[fmt]
    target = EXPORT_DIR / f"{model_path.stem}_{imgsz}{suffix}"
    if target.exists():
        return target
    print(f"  exporting to {fmt.upper()} at {imgsz} px (one time only, ~1 min)...")
    out = Path(YOLO(str(model_path)).export(format=fmt, imgsz=imgsz, half=False, dynamic=False, verbose=False))
    out.rename(target)
    return target


def time_setup(name, weights, imgsz, device, frames, runs, warmup=3):
    """Time model.predict() end to end (pre-process + inference + post-process)."""
    from ultralytics import YOLO
    model = YOLO(str(weights), task="detect")
    kwargs = dict(imgsz=imgsz, conf=PERSON_CONF, device=device, verbose=False)
    for i in range(warmup):                       # first calls are always slow
        model.predict(frames[i % len(frames)], **kwargs)
    times, n_boxes = [], []
    for i in range(runs):
        t0 = time.perf_counter()
        r = model.predict(frames[i % len(frames)], **kwargs)[0]
        times.append((time.perf_counter() - t0) * 1000)
        n_boxes.append(len(r.boxes))
    times.sort()
    mean = statistics.mean(times)
    p95 = times[min(len(times) - 1, int(0.95 * len(times)))]
    return dict(setup=name, imgsz=imgsz, mean_ms=round(mean, 1), p95_ms=round(p95, 1),
                max_fps=round(1000 / mean, 1), fits_5fps=p95 <= BUDGET_MS,
                avg_boxes=round(statistics.mean(n_boxes), 1))


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description="Rasid model speed test")
    ap.add_argument("--model", type=Path, default=DEFAULT_MODEL, help="path to the .pt model")
    ap.add_argument("--images", type=str, default=None, help="folder of drone frames (optional)")
    ap.add_argument("--runs", type=int, default=30, help="timed runs per setup")
    ap.add_argument("--sizes", type=int, nargs="+", default=[960, 640], help="input sizes to test")
    ap.add_argument("--skip-export", action="store_true", help="only test the .pt model")
    args = ap.parse_args()

    if not args.model.exists():
        sys.exit(f"Model not found: {args.model}\nPut rasid_v3_yolo26s_960.pt in ground_station/models/")

    device, desc = device_info()
    print("=" * 66)
    print("RASID SPEED TEST")
    print(f"Machine : {platform.system()} {platform.release()} | {desc}")
    print(f"Model   : {args.model.name}")
    print(f"Budget  : {BUDGET_MS:.0f} ms per frame ({STREAM_FPS} fps stream)")
    print("=" * 66)
    frames = load_frames(args.images)

    setups = [("PyTorch", args.model, s) for s in args.sizes]
    if not args.skip_export and device == "cpu":   # on a GPU, .pt is already fast
        for fmt in ["onnx", "openvino"]:
            for s in args.sizes:
                try:
                    setups.append((fmt.upper() if fmt == "onnx" else "OpenVINO", export(args.model, fmt, s), s))
                except Exception as e:
                    print(f"  ! skipped {fmt} at {s}px: {type(e).__name__}: {str(e)[:120]}")

    results = []
    for name, weights, s in setups:
        print(f"\nTiming {name} at {s} px ({args.runs} runs)...")
        try:
            r = time_setup(name, weights, s, device, frames, args.runs)
        except Exception as e:
            print(f"  ! failed: {type(e).__name__}: {str(e)[:160]}")
            continue
        results.append(r)
        print(f"  mean {r['mean_ms']} ms | p95 {r['p95_ms']} ms | up to {r['max_fps']} fps | "
              f"{'OK for 5 fps' if r['fits_5fps'] else 'TOO SLOW for 5 fps'}")

    if not results:
        sys.exit("No setup could be timed - send me the error messages above.")

    # ---- summary
    print("\n" + "=" * 66)
    print(f"{'setup':<10}{'size':>6}{'mean ms':>10}{'p95 ms':>9}{'max fps':>9}   5 fps?")
    for r in results:
        print(f"{r['setup']:<10}{r['imgsz']:>6}{r['mean_ms']:>10}{r['p95_ms']:>9}{r['max_fps']:>9}   "
              f"{'yes' if r['fits_5fps'] else 'no'}")
    print("=" * 66)

    ok = [r for r in results if r["fits_5fps"]]
    ok960 = [r for r in ok if r["imgsz"] == 960]
    if ok960:
        best = min(ok960, key=lambda r: r["mean_ms"])
        print(f"VERDICT: use {best['setup']} at 960 px - full accuracy, fits the 5 fps stream.")
    elif ok:
        best = min(ok, key=lambda r: r["mean_ms"])
        print(f"VERDICT: 960 px is too slow here. {best['setup']} at {best['imgsz']} px fits.\n"
              f"         Trade-off: smaller input = more tiny people missed.")
    else:
        best = min(results, key=lambda r: r["mean_ms"])
        every = int(np.ceil(best["mean_ms"] / BUDGET_MS))
        print(f"VERDICT: nothing fits 5 fps. Fastest is {best['setup']} at {best['imgsz']} px "
              f"({best['mean_ms']} ms).\n         Option: run detection on every {every}th frame, or use Colab.")

    out = HERE / "speed_results.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["machine"] + list(results[0].keys()))
        w.writeheader()
        for r in results:
            w.writerow({"machine": desc, **r})
    print(f"\nSaved: {out}")


if __name__ == "__main__":
    main()