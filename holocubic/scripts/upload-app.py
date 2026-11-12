"""Upload the Lua app to a HoloCubic device and verify reported file sizes."""

import json
import sys
from pathlib import Path
from urllib.parse import quote
from urllib.request import ProxyHandler, Request, build_opener

source = Path(__file__).resolve().parents[1] / "live2d"
base_url = sys.argv[1].rstrip("/")
client = build_opener(ProxyHandler({}))
count = 0
for path in sorted(source.rglob("*")):
    if not path.is_file() or path.suffix == ".md":
        continue
    destination = "/sd/apps/live2d/" + path.relative_to(source).as_posix()
    data = path.read_bytes()
    request = Request(
        base_url + "/api/system/fs/upload?path=" + quote(destination, safe="/"),
        data=data,
        headers={"Content-Type": "application/octet-stream"},
        method="PUT",
    )
    with client.open(request, timeout=60) as response:
        result = json.load(response)
    if not result.get("ok") or result.get("entry", {}).get("size") != len(data):
        raise RuntimeError(f"Upload verification failed: {destination}: {result}")
    count += 1
    print(f"Verified {destination}: {len(data)} bytes", flush=True)
print(f"Uploaded and verified {count} files.")
