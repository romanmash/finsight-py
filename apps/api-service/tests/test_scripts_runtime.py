"""Runtime behavior tests for operational shell scripts."""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest


def _discover_bash() -> str | None:
    candidates: list[str] = []
    which_bash = shutil.which("bash")
    if which_bash is not None:
        candidates.append(which_bash)

    candidates.extend(
        [
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files\Git\usr\bin\bash.exe",
            r"C:\Windows\System32\bash.exe",
        ]
    )

    seen: set[str] = set()
    for candidate in candidates:
        normalized = os.path.normcase(os.path.abspath(candidate))
        if normalized in seen:
            continue
        seen.add(normalized)
        if not os.path.exists(candidate):
            continue
        try:
            probe = subprocess.run(
                [candidate, "--version"],
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError:
            continue
        if probe.returncode == 0:
            return candidate
    return None


_BASH = _discover_bash()
_BASH_USABLE = _BASH is not None

pytestmark = pytest.mark.skipif(
    not _BASH_USABLE,
    reason="usable bash is required for script runtime tests",
)


def _make_executable(path: Path) -> None:
    current = path.stat().st_mode
    path.chmod(current | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    _make_executable(path)


@pytest.fixture()
def script_tmp_dir() -> Iterator[Path]:
    root = Path(".cache/tests").resolve()
    root.mkdir(parents=True, exist_ok=True)
    test_dir = root / f"script-runtime-{uuid.uuid4().hex}"
    test_dir.mkdir(parents=True, exist_ok=False)
    try:
        yield test_dir
    finally:
        shutil.rmtree(test_dir, ignore_errors=True)


def _run_script(
    script_path: Path,
    *,
    cwd: Path,
    env: dict[str, str],
    args: list[str],
) -> subprocess.CompletedProcess[str]:
    if _BASH is None:
        msg = "bash is unavailable"
        raise RuntimeError(msg)
    return subprocess.run(
        [_BASH, str(script_path), *args],
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def test_deploy_script_fails_with_missing_required_vars(script_tmp_dir: Path) -> None:
    script_path = Path("scripts/deploy.sh").resolve()
    env = os.environ.copy()
    env.pop("SERVER_HOST", None)
    env.pop("SERVER_USER", None)
    env.pop("SERVER_PATH", None)
    env.pop("SERVER_SSH_KEY", None)
    env.pop("DEPLOY_HOST", None)
    env.pop("DEPLOY_USER", None)
    env.pop("DEPLOY_PATH", None)

    result = _run_script(script_path, cwd=script_tmp_dir, env=env, args=[])
    assert result.returncode == 1
    assert "Missing required environment variables" in result.stderr


def test_deploy_script_stops_when_migration_fails(script_tmp_dir: Path) -> None:
    script_path = Path("scripts/deploy.sh").resolve()

    fake_bin = script_tmp_dir / "bin"
    fake_bin.mkdir(parents=True, exist_ok=True)
    call_log = script_tmp_dir / "calls.log"
    key_path = script_tmp_dir / "id_ed25519"
    key_path.write_text("dummy-key", encoding="utf-8")

    _write_executable(
        fake_bin / "rsync",
        "#!/usr/bin/env bash\n"
        "echo \"rsync $*\" >> \"${TEST_CALL_LOG}\"\n"
        "exit 0\n",
    )
    _write_executable(
        fake_bin / "ssh",
        "#!/usr/bin/env bash\n"
        "echo \"ssh $*\" >> \"${TEST_CALL_LOG}\"\n"
        "if [[ \"$*\" == *\"alembic upgrade head\"* ]]; then exit 1; fi\n"
        "exit 0\n",
    )

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env.get('PATH', '')}"
    env["SERVER_HOST"] = "example.host"
    env["SERVER_USER"] = "deployer"
    env["SERVER_PATH"] = "/opt/finsight"
    env["SERVER_SSH_KEY"] = str(key_path)
    env["TEST_CALL_LOG"] = str(call_log)

    result = _run_script(script_path, cwd=script_tmp_dir, env=env, args=[])
    assert result.returncode == 1
    assert "Migration failed. Aborting deployment. Services NOT restarted." in result.stderr

    calls = call_log.read_text(encoding="utf-8")
    assert "rsync " in calls
    assert "alembic upgrade head" in calls
    assert "docker compose up -d --build" not in calls


def test_logs_script_maps_postgres_alias_to_db(script_tmp_dir: Path) -> None:
    script_path = Path("scripts/logs.sh").resolve()

    fake_bin = script_tmp_dir / "bin"
    fake_bin.mkdir(parents=True, exist_ok=True)
    call_log = script_tmp_dir / "ssh.log"
    key_path = script_tmp_dir / "id_ed25519"
    key_path.write_text("dummy-key", encoding="utf-8")

    _write_executable(
        fake_bin / "ssh",
        "#!/usr/bin/env bash\n"
        "echo \"$*\" > \"${TEST_SSH_LOG}\"\n"
        "exit 0\n",
    )

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env.get('PATH', '')}"
    env["SERVER_HOST"] = "example.host"
    env["SERVER_USER"] = "deployer"
    env["SERVER_PATH"] = "/opt/finsight"
    env["SERVER_SSH_KEY"] = str(key_path)
    env["TEST_SSH_LOG"] = str(call_log)

    result = _run_script(script_path, cwd=script_tmp_dir, env=env, args=["postgres"])
    assert result.returncode == 0
    ssh_args = call_log.read_text(encoding="utf-8")
    assert "docker compose logs -f db" in ssh_args
