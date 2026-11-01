#!/usr/bin/env bash
set -e

echo "Running Rokad Attendance Platform Smoke Test..."
node --experimental-strip-types scripts/smoke.js
