import sys
import os
import traceback
from pathlib import Path

# Redirect stdio to devnull if spawned without a console from a GUI app
if sys.stdout is None:
    try:
        sys.stdout = open(os.devnull, 'w', encoding='utf-8')
    except Exception:
        pass
if sys.stderr is None:
    try:
        sys.stderr = open(os.devnull, 'w', encoding='utf-8')
    except Exception:
        pass

try:
    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    import uvicorn
    from app.main import app

    if __name__ == '__main__':
        uvicorn.run(app, host='127.0.0.1', port=8000, log_level='info')
except Exception as e:
    temp_dir = os.environ.get("TEMP", os.environ.get("TMP", "."))
    try:
        with open(os.path.join(temp_dir, "swiftbalt_backend_crash.log"), "w", encoding="utf-8") as f:
            traceback.print_exc(file=f)
    except Exception:
        pass
    raise

