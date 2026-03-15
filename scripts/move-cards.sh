#!/bin/bash
set -eux
PROJECT="/users/langningchen/projectsV2/8"
ACCEPT_HEADER="application/vnd.github+json"

move_cards() {
ENCODED_STATUS=$(printf '%s' "$1" | jq -s -R -r @uri)
cards_json=$(gh api "$PROJECT/items?q=status:$ENCODED_STATUS" -H "Accept: $ACCEPT_HEADER")
echo "$cards_json" | jq -r '.[].id' | while read -r card_id; do
    if [ -z "$card_id" ] || [ "$card_id" = "null" ]; then
    continue
    fi
    echo "Moving card $card_id -> column $2"
    gh api -X PATCH $PROJECT/items/"$card_id" -H "Accept: $ACCEPT_HEADER" --input - <<< '{
    "fields": [
        {
        "id": 234281529,
        "value": "'"$2"'"
        }
    ]
    }'
done
}

if [ "$PRE_RELEASE" = "false" ]; then
echo "Normal release: moving Done -> Released and Pre-release -> Released"
move_cards "Done" 98236657
move_cards "Pre-released" 98236657
else
echo "Pre-release only: moving Done -> Pre-release"
move_cards "Done" 300944f4
fi
