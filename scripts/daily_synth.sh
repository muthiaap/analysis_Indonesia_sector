#!/bin/bash
set -uo pipefail
REPO=/Users/67620/scrap_sector/analysis_Indonesia_sector
LOG=/Users/67620/Library/Logs/valuechain-dailysynth.log
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$REPO" || exit 1
echo "===== $(date '+%F %T') start =====" >> "$LOG"
BATCH="$(python3 vc_next_batch.py 5)"
if [ -z "$BATCH" ]; then echo "nothing to do (queue empty)" >> "$LOG"; echo "===== $(date '+%F %T') end =====" >> "$LOG"; exit 0; fi
echo "batch: $BATCH" >> "$LOG"
PROMPT="$(sed "s/__TICKERS__/$BATCH/g" scripts/daily_synth_prompt.txt)"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "[DRY_RUN] would invoke: claude -p <prompt> --dangerously-skip-permissions" >> "$LOG"
  echo "----- prompt preview -----" >> "$LOG"; echo "$PROMPT" | head -3 >> "$LOG"
else
  claude -p "$PROMPT" --dangerously-skip-permissions >> "$LOG" 2>&1
fi
echo "===== $(date '+%F %T') end =====" >> "$LOG"
