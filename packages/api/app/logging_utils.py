from __future__ import annotations

import json
import logging
from datetime import datetime, timezone


logger = logging.getLogger("sf_docs_mcp")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


def log_event(event: str, **kwargs: object) -> None:
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **kwargs,
    }
    logger.info(json.dumps(payload, sort_keys=True))
