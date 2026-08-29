import sys
import time
import urllib.error
import urllib.request
from contextlib import suppress
from subprocess import Popen

HEALTH_URL = "http://127.0.0.1:8000/health"
TIMEOUT_SECONDS = 30


def wait_for_health() -> bool:
    deadline = time.monotonic() + TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        with (
            suppress(urllib.error.URLError, ConnectionError),
            urllib.request.urlopen(HEALTH_URL, timeout=2) as response,
        ):
            return bool(response.status == 200)
        time.sleep(0.5)
    return False


def main() -> int:
    server = Popen([sys.executable, "-m", "uvicorn", "sispaniers.main:app", "--port", "8000"])
    try:
        if not wait_for_health():
            print(f"FAIL: {HEALTH_URL} never answered within {TIMEOUT_SECONDS}s")
            return 1
        print(f"OK: {HEALTH_URL} answered 200")
        return 0
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__ == "__main__":
    raise SystemExit(main())
