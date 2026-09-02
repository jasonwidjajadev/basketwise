#!/bin/bash
cd /Users/brandan/Sync/uni/Devsoc/TP26T2/basketwise/scraper
for attempt in $(seq 1 30); do
  ./hyperscrape -store woolworths -db data/hyper_woolworths.db -phase all -start-rate 0.1 -max-rate 6 -workers 16 -max-inflight 12 -pause 8s -seed-db woolworths.db > data/woolworths.ndjson 2> data/woolworths.log
  code=$?
  if [ $code -eq 0 ]; then echo "WW_DONE_OK attempt=$attempt"; exit 0; fi
  # exit 2 = blocked at warmup; wait and retry
  echo "WW_RETRY attempt=$attempt exit=$code $(date +%H:%M:%S)"
  sleep 20
done
echo "WW_GAVE_UP"
