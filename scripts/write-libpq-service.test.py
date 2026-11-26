from __future__ import annotations

import contextlib
import importlib.util
import io
import os
import tempfile
import unittest
from unittest import mock
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("write-libpq-service.py")
SPEC = importlib.util.spec_from_file_location("write_libpq_service", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LibpqServiceFileTests(unittest.TestCase):
    def test_writes_protected_service_file_without_echoing_secret(self) -> None:
        secret = "P%40ssword"
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "service.conf"
            argv = ["write-libpq-service.py", "production", str(output), "DATABASE_URL"]
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                with unittest.mock.patch.dict(
                    os.environ,
                    {"DATABASE_URL": f"postgresql://garden:{secret}@db.example:6543/postgres?sslmode=require"},
                ), mock.patch.object(MODULE.sys, "argv", argv):
                    self.assertEqual(MODULE.main(), 0)
            content = output.read_text()
            self.assertIn("[production]", content)
            self.assertIn('password="P@ssword"', content)
            self.assertIn('sslmode="require"', content)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)

    def test_rejects_non_tls_connection_urls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "service.conf"
            argv = ["write-libpq-service.py", "restore", str(output), "DATABASE_URL"]
            with mock.patch.dict(
                os.environ,
                {"DATABASE_URL": "postgresql://garden:secret@db.example/postgres?sslmode=disable"},
            ), mock.patch.object(MODULE.sys, "argv", argv):
                with self.assertRaisesRegex(ValueError, "database TLS must be required"):
                    MODULE.main()
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
