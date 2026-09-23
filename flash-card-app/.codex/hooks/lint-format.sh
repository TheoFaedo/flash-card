#!/usr/bin/env bash
set -u

project_root="$(git rev-parse --show-toplevel)/flash-card-app"
cd "$project_root" || exit 1

lint_status=0
format_status=0

bun run lint || lint_status=$?
bun run format || format_status=$?

if (( lint_status != 0 || format_status != 0 )); then
  printf '{"decision":"block","reason":"The automatic lint/format hook failed (lint exit: %s, format exit: %s). Inspect the command output, fix the issue, and try again."}\n' "$lint_status" "$format_status"
fi
