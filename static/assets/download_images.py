import json
from pathlib import Path
from urllib.request import Request, urlopen

ASSETS_DIR = Path(__file__).resolve().parent
manifest = json.loads((ASSETS_DIR / "images_manifest.json").read_text(encoding="utf-8"))

ok = 0
fail = 0
for url, filename in manifest.items():
    target = ASSETS_DIR / filename
    if target.exists() and target.stat().st_size > 0:
        print(f"Уже есть: {filename}")
        ok += 1
        continue
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=30) as r:
            data = r.read()
        target.write_bytes(data)
        print(f"Скачано: {filename}")
        ok += 1
    except Exception as e:
        print(f"Ошибка: {filename} <- {url}\n  {e}")
        fail += 1
print(f"Готово. Успешно: {ok}, ошибок: {fail}")
