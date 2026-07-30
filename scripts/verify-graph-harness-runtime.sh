#!/usr/bin/env bash
set -euo pipefail

FRAMEWORK_REPOSITORY="https://github.com/BernydotJar/Graph-harness-sdlc.git"
FRAMEWORK_COMMIT="1bebce3db35303072049233786464bb01163c98b"
RUNTIME_COMMIT="fef364bc66849b98c08d3c1dcb91caf9701027cd"
PROJECT_PATH="${1:-program/graph-harness/project.json}"
EVENTS_PATH="${2:-program/graph-harness/events.jsonl}"

case "$PROJECT_PATH" in
  program/graph-harness/project.json) ;;
  *) echo "unexpected project path" >&2; exit 2 ;;
esac
case "$EVENTS_PATH" in
  program/graph-harness/events.jsonl) ;;
  *) echo "unexpected events path" >&2; exit 2 ;;
esac

TEMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEMP_ROOT"' EXIT
python3 -m venv "$TEMP_ROOT/venv"
"$TEMP_ROOT/venv/bin/pip" install --disable-pip-version-check --no-input --quiet \
  "git+${FRAMEWORK_REPOSITORY}@${FRAMEWORK_COMMIT}"

FREEZE_OUTPUT="$("$TEMP_ROOT/venv/bin/pip" freeze)"
printf '%s\n' "$FREEZE_OUTPUT" | grep -F \
  "graph-harness-sdlc @ git+${FRAMEWORK_REPOSITORY}@${FRAMEWORK_COMMIT}" >/dev/null

"$TEMP_ROOT/venv/bin/python" -m graph_harness \
  --project "$PROJECT_PATH" \
  --events "$EVENTS_PATH" \
  validate > "$TEMP_ROOT/validate.json"
"$TEMP_ROOT/venv/bin/python" -m graph_harness \
  --project "$PROJECT_PATH" \
  --events "$EVENTS_PATH" \
  status > "$TEMP_ROOT/status.json"
"$TEMP_ROOT/venv/bin/python" -m graph_harness \
  --project "$PROJECT_PATH" \
  --events "$EVENTS_PATH" \
  ready > "$TEMP_ROOT/ready.json"

python3 - "$TEMP_ROOT/status.json" "$PROJECT_PATH" "$FRAMEWORK_COMMIT" "$RUNTIME_COMMIT" <<'PY'
import json
import sys
from pathlib import Path

status_path, project_path, framework_commit, runtime_commit = sys.argv[1:]
status = json.loads(Path(status_path).read_text())
project = json.loads(Path(project_path).read_text())
if status.get("schema_version") != "graph-harness.state.v1":
    raise SystemExit("unexpected state schema")
if status.get("project_id") != project.get("project_id"):
    raise SystemExit("project identity mismatch")
if int(status.get("event_count", 0)) < 51:
    raise SystemExit("event chain is unexpectedly truncated")
node = next((item for item in project.get("nodes", []) if item.get("id") == "PRG-GRAPH-HARNESS-PIN-002"), None)
if not node:
    raise SystemExit("immutable pin node is missing")
metadata = node.get("metadata", {})
if metadata.get("framework_commit") != framework_commit:
    raise SystemExit("framework commit pin mismatch")
if metadata.get("runtime_commit") != runtime_commit:
    raise SystemExit("runtime commit pin mismatch")
if Path("graph_harness").exists():
    raise SystemExit("application must not copy framework runtime source")
print(json.dumps({
    "status": "pass",
    "framework_commit": framework_commit,
    "runtime_commit": runtime_commit,
    "event_count": status["event_count"],
    "node_count": len(status.get("nodes", [])),
}, sort_keys=True))
PY
