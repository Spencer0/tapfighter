#!/usr/bin/env bash
# Records all four scenes into $1 (default /tmp/tapfighter-promo). Needs the repo served on :8765.
set -e
OUT=${1:-/tmp/tapfighter-promo}
cd "$(dirname "$0")"
node capture.mjs boss  2.7 "$OUT/s1"
node capture.mjs rune  2.6 "$OUT/s2"
node capture.mjs crits 2.8 "$OUT/s3"
node capture.mjs loot  3.9 "$OUT/s4"
