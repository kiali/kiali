#!/bin/bash

# Calculate timestamps for the last 4 weeks
NOW=$(date +%s)
FOUR_WEEKS_AGO=$(($NOW - 4 * 7 * 24 * 60 * 60))

echo "Querying Kiali API for the last 4 weeks..."
echo "From: $FOUR_WEEKS_AGO"
echo "Since: $NOW"

curl -s "http://localhost:20001/kiali/api/chat/usage?window=weekly&from=$FOUR_WEEKS_AGO&since=$NOW" | jq .
