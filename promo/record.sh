#!/usr/bin/env bash
# Records scenes into $2 (default /tmp/tapfighter-promo). Needs the repo served on :8765.
#   record.sh v1 [dir]   "Hardest game ever?"   (boss, rune, crits, loot)
#   record.sh v2 [dir]   "Can you master this timing?"   (pumpkin boss + rhythm death, shop)
# For v2 the pumpkin death lands a little differently each run: re-record s1 until DEFEAT is at ~8.5-9.3s in s1/events.json.
set -e
V=${1:-v1}; OUT=${2:-/tmp/tapfighter-promo}
cd "$(dirname "$0")"
if [ "$V" = v1 ]; then
  node capture.mjs boss  2.7 "$OUT/s1"
  node capture.mjs rune  2.6 "$OUT/s2"
  node capture.mjs crits 2.8 "$OUT/s3"
  node capture.mjs loot  3.9 "$OUT/s4"
else
  node capture.mjs pumpkin 10 "$OUT/s1"
  node capture.mjs shop     3 "$OUT/s2"
fi
