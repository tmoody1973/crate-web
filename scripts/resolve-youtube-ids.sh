#!/usr/bin/env bash
# Resolve YouTube video IDs for all Tiny Desk concerts in catalog.json
# Uses yt-dlp to search YouTube. Saves progress incrementally.
#
# Usage: ./scripts/resolve-youtube-ids.sh [--resume] [--limit N]
#
# Output: public/tinydesk/catalog.json is updated in-place with youtubeId fields

set -euo pipefail

CATALOG="public/tinydesk/catalog.json"
PROGRESS_FILE="public/tinydesk/.youtube-progress.json"
BATCH_SIZE=5

RESUME=false
LIMIT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resume) RESUME=true; shift ;;
    --limit) LIMIT="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [ ! -f "$CATALOG" ]; then
  echo "Error: $CATALOG not found"
  exit 1
fi

# Initialize progress file if needed
if [ "$RESUME" = true ] && [ -f "$PROGRESS_FILE" ]; then
  echo "Resuming from progress file..."
else
  cp "$CATALOG" "$PROGRESS_FILE"
fi

TOTAL=$(python3 -c "import json; d=json.load(open('$PROGRESS_FILE')); print(sum(1 for c in d if not c.get('youtubeId')))")
echo "Concerts needing YouTube IDs: $TOTAL"

if [ "$LIMIT" -gt 0 ]; then
  echo "Limiting to $LIMIT lookups"
fi

COUNT=0
FOUND=0
FAILED=0

# Process each concert without a YouTube ID
python3 -c "
import json
data = json.load(open('$PROGRESS_FILE'))
for i, c in enumerate(data):
    if not c.get('youtubeId'):
        print(f\"{i}|{c['artist']}|{c['concertType']}\")
" | while IFS='|' read -r IDX ARTIST TYPE; do
  if [ "$LIMIT" -gt 0 ] && [ "$COUNT" -ge "$LIMIT" ]; then
    break
  fi

  COUNT=$((COUNT + 1))

  # Build search query
  if [ "$TYPE" = "Tiny Desk Home Concert" ]; then
    QUERY="$ARTIST tiny desk home concert NPR"
  else
    QUERY="$ARTIST tiny desk concert NPR"
  fi

  echo -n "[$COUNT/$TOTAL] $ARTIST... "

  # Search YouTube via yt-dlp
  VIDEO_ID=$(yt-dlp --get-id "ytsearch1:$QUERY" 2>/dev/null || echo "")

  if [ -n "$VIDEO_ID" ]; then
    echo "✓ $VIDEO_ID"
    FOUND=$((FOUND + 1))

    # Update progress file
    python3 -c "
import json
data = json.load(open('$PROGRESS_FILE'))
data[$IDX]['youtubeId'] = '$VIDEO_ID'
json.dump(data, open('$PROGRESS_FILE', 'w'), indent=2)
"
  else
    echo "✗ not found"
    FAILED=$((FAILED + 1))
  fi

  # Rate limit: small delay between requests
  sleep 1

  # Save to catalog every BATCH_SIZE
  if [ $((COUNT % BATCH_SIZE)) -eq 0 ]; then
    cp "$PROGRESS_FILE" "$CATALOG"
    echo "  [saved progress: $FOUND found, $FAILED failed]"
  fi
done

# Final save
cp "$PROGRESS_FILE" "$CATALOG"
echo ""
echo "Done! Found: $FOUND, Failed: $FAILED"
echo "Catalog updated at $CATALOG"
