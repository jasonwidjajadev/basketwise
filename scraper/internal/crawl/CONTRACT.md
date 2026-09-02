# hyperscrape Go <-> Python contract

Binary: `./hyperscrape -store coles|woolworths -db data/hyper_<store>.db -phase list|detail|all [-start-rate 0.1|auto] [-max-rate 400] [-pause 5s] [-seed-db old.db] [-cookies cookies.json] [-stats-interval 250ms] [-max-pages N] [-quiet]`
Cookies file: Playwright `context.cookies()` JSON: `[{"name","value","domain","path",...}]`.
Exit code 0 = done, 2 = blocked (needs cookies / browser mode), 1 = other error. SIGINT/SIGTERM => flush and exit 0.

stdout: one JSON object per line.
{"t":"stats","store":"coles","phase":"list|detail|done","elapsed_s":12.3,
 "rate_target":42.0,"rate_actual":40.1,"inflight":9,"ctrl":"slowstart|probe|paused","pause_remaining_s":0,"best_rate":60.0,"p50_ms":180,
 "bytes_wire":123456,"bytes_raw":456789,"bytes_wire_s":51200.0,"bytes_raw_s":204800.0,
 "requests":1234,"req_s":40.1,"pages":120,"pages_s":3.0,
 "products":5760,"products_s":140.0,"unique":5100,"dupes":660,"unchanged":12,
 "details":300,"details_s":30.0,
 "errors":3,"errors_by_code":{"429":2,"net":1},"backoffs":1,"challenges":0,
 "queue_list":40,"queue_detail":4800,"eta_s":120.0,"last_error":"429 on /x"}
{"t":"event","store":"coles","event":"start|build_id|blocked|done|error","msg":"..."}
stderr: human log lines.
