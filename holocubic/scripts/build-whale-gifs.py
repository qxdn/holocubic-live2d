"""Convert whalegirl tracks to device GIFs. Requires Pillow."""

import json
from pathlib import Path

from PIL import Image


root = Path(__file__).resolve().parents[1]
source = root / "src/asset/whalegirl"
output = root / "live2d/assets"
config = json.loads((source / "pet.json").read_text(encoding="utf-8"))["frames2d"]
output.mkdir(parents=True, exist_ok=True)
metadata = {}

for name, track in config["tracks"].items():
    timings = track.get("frameMs", [config["defaultFrameMs"]] * len(track["frames"]))
    if len(timings) != len(track["frames"]):
        raise ValueError(f"{name}: frame timing count mismatch")
    frames, durations = [], []
    elapsed, rounded = 0, 0
    for filename, milliseconds in zip(track["frames"], timings):
        with Image.open(source / config["dir"] / name / filename) as image:
            image = image.convert("RGBA")
            image.thumbnail((144, 198), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (144, 198), (17, 24, 32))
            canvas.paste(image, ((144 - image.width) // 2, (198 - image.height) // 2), image)
            frames.append(canvas)
        # GIF timing has 10 ms precision; round cumulatively to avoid drift.
        elapsed += milliseconds / 0.75
        next_rounded = round(elapsed / 10) * 10
        durations.append(next_rounded - rounded)
        rounded = next_rounded

    loop = track.get("loop", True)
    options = {"loop": 0} if loop else {}
    path = output / f"{name}.gif"
    frames[0].save(path, save_all=True, append_images=frames[1:],
                   duration=durations, optimize=False, disposal=2, **options)
    with Image.open(path) as gif:
        assert gif.size == (144, 198)
        assert gif.n_frames == len(frames)
        assert gif.info.get("loop") == (0 if loop else None)
        total = 0
        for index in range(gif.n_frames):
            gif.seek(index)
            gif.load()
            total += gif.info["duration"]
        assert total == sum(durations)
    print(f"{name}: {len(frames)} frames, {total} ms, loop={loop}, {path.stat().st_size} bytes")
    metadata[name] = {"duration_ms": total, "loop": loop}

(output / "animations.json").write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
