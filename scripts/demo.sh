#!/usr/bin/env bash
# Drives the built server through the official MCP Inspector CLI and fails if any
# result is not what the server promises. Run `npm run build` first.
set -euo pipefail

INSPECTOR="npx -y @modelcontextprotocol/inspector@2.12.0 --cli node dist/index.js"

# The Inspector exits non-zero when a tool returns isError, which is expected for
# refused requests, so the exit code is ignored and the output is checked instead.
call() {
  $INSPECTOR --method tools/call "$@" 2>/dev/null || true
}

echo "== tools/list"
tools=$($INSPECTOR --method tools/list 2>/dev/null)
echo "$tools" | grep -q '"read_file"' || { echo "read_file tool missing"; exit 1; }
echo "$tools" | grep -o '"name": "[a-z_]*"' | sort -u

echo
echo "== search_text: webhook"
result=$(call --tool-name search_text --tool-arg query=webhook)
echo "$result"
echo "$result" | grep -q 'meeting-2026-03-30.md' || { echo "expected a match in the meeting notes"; exit 1; }

echo
echo "== json_extract: orders[0].total"
result=$(call --tool-name json_extract --tool-arg 'json="{\"orders\":[{\"total\":398}]}"' --tool-arg 'path=orders[0].total')
echo "$result"
echo "$result" | grep -q '398' || { echo "expected 398"; exit 1; }

echo
echo "== read_file: sandbox escape must be refused"
result=$(call --tool-name read_file --tool-arg path=../../etc/passwd)
echo "$result"
echo "$result" | grep -q '"isError": true' || { echo "escape was not refused"; exit 1; }

echo
echo "Demo passed: 4 checks, all as expected."
