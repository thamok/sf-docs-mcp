from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    hosted_mode: bool
    bearer_token: str
    cors_allowlist: tuple[str, ...]



def load_settings() -> Settings:
    allowlist = tuple(
        origin.strip() for origin in os.getenv("CORS_ALLOWLIST", "").split(",") if origin.strip()
    )
    return Settings(
        hosted_mode=os.getenv("HOSTED_MODE", "false").lower() == "true",
        bearer_token=os.getenv("BEARER_TOKEN", ""),
        cors_allowlist=allowlist,
    )
