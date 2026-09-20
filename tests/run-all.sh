#!/bin/sh
# 跑全部回归套件。用法：  sh tests/run-all.sh
# 只跑一套：            sh tests/run-all.sh dev-test-budget.js
set -e
cd "$(dirname "$0")"

NODE=/Users/xiaodongwang/.workbuddy/binaries/node/versions/22.22.2-3/bin/node
export NODE_PATH=/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules

SUITES="dev-regression-test.js dev-test-text-replace.js dev-test-meter.js dev-test-timetable.js dev-test-collapse.js dev-test-hover-swap.js dev-test-budget.js dev-test-bg-image.js"

if [ -n "$1" ]; then SUITES="$1"; fi

for f in $SUITES; do
  printf '\n========== %s ==========\n' "$f"
  "$NODE" "$f"
done
