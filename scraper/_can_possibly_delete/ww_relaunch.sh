#!/bin/bash
cd /Users/brandan/Sync/uni/Devsoc/TP26T2/basketwise/scraper
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'
code=$(curl -sS -o /dev/null -w "%{http_code}" -A "$UA" -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' -H 'sec-fetch-user: ?1' --compressed https://www.woolworths.com.au/shop/browse/fruit-veg)
running=$(pgrep -f "hyperscrape -store woolworths" | head -1)
if [ "$code" = "200" ] && [ -z "$running" ]; then
  # only (re)launch if not already done successfully
  done=$(grep -c '"event":"done"' data/woolworths.ndjson 2>/dev/null || echo 0)
  if [ "$done" = "0" ]; then
    nohup ./hyperscrape -store woolworths -db data/hyper_woolworths.db -phase all -start-rate 0.1 -max-rate 10 -workers 32 -max-inflight 24 -seed-db woolworths.db > data/woolworths.ndjson 2> data/woolworths.log &
    echo $! > data/woolworths.pid
    echo "WW_LAUNCHED code=$code pid=$(cat data/woolworths.pid)"
  fi
elif [ "$code" = "200" ] && [ -n "$running" ]; then
  echo "WW_RUNNING code=$code"
else
  echo "WW_WALLED code=$code"
fi
