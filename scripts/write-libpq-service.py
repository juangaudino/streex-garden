#!/usr/bin/env python3
"""Write a mode-0600 libpq service file from a protected connection URL."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlsplit


def quote_service_value(value: str) -> str:
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("connection URL contains control characters")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: write-libpq-service.py SERVICE_NAME OUTPUT_PATH URL_ENV_NAME", file=sys.stderr)
        return 2
    service, output_name, url_env = sys.argv[1:]
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", service):
        raise ValueError("invalid service name")
    url = os.environ.get(url_env, "")
    parsed = urlsplit(url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname or not parsed.path.strip("/"):
        raise ValueError("connection URL must identify a PostgreSQL host and database")
    if parsed.username is None or parsed.password is None:
        raise ValueError("connection URL must include database authentication")

    params = {
        "host": parsed.hostname,
        "port": str(parsed.port or 5432),
        "dbname": unquote(parsed.path.lstrip("/")),
        "user": unquote(parsed.username),
        "password": unquote(parsed.password),
    }
    query = dict(parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True))
    unsupported = set(query) - {"sslmode", "connect_timeout", "application_name"}
    if unsupported:
        raise ValueError("connection URL has unsupported query parameters")
    params.update({key: value for key, value in query.items()})
    params.setdefault("sslmode", "require")
    if params["sslmode"] not in {"require", "verify-ca", "verify-full"}:
        raise ValueError("database TLS must be required")

    output = Path(output_name)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(output, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        stream.write(f"[{service}]\n")
        for key, value in params.items():
            stream.write(f"{key}={quote_service_value(value)}\n")
    os.chmod(output, 0o600)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"Could not create protected libpq service file: {error}", file=sys.stderr)
        raise SystemExit(1)
