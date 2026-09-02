#!/usr/bin/env python3
"""Fake hyperscrape binary: emits CONTRACT-shaped NDJSON so the TUI can be tested
without hitting the network. Usage mirrors the Go flags (most are ignored)."""
import argparse, json, math, random, sys, time
ap = argparse.ArgumentParser()
for f in ("-store","-db","-phase","-start-rate","-max-rate","-pause","-workers","-max-inflight","-seed-db","-cookies","-stats-interval"):
    ap.add_argument(f)
a, _ = ap.parse_known_args()
store = a.store or "coles"
print(json.dumps({"t":"event","store":store,"event":"start","msg":"fake"})); sys.stdout.flush()
t0=time.time(); rate=0.1; uniq=0; dup=0; det=0; req=0; pages=0; wire=0; raw=0; err=0; back=0
for i in range(24):
    dt=0.25; time.sleep(dt); el=time.time()-t0
    rate=min(rate*1.5+1, 60); 
    if random.random()<0.08: back+=1; err+=1; rate/=2
    req+=int(rate*dt); pages+=random.randint(0,3); newp=random.randint(20,90)
    uniq+=int(newp*0.8); dup+=int(newp*0.2); det+=random.randint(0,40)
    wire+=int(rate*dt*4000); raw+=int(rate*dt*20000)
    print(json.dumps({"t":"stats","store":store,"phase":"list" if el<3 else "detail","elapsed_s":el,
      "rate_target":round(rate,2),"rate_actual":round(rate*0.9,2),"inflight":random.randint(0,20),
      "ctrl":"paused" if back and random.random()<0.2 else random.choice(["slowstart","probe"]),"pause_remaining_s":0,
      "best_rate":round(rate,1),"p50_ms":random.randint(40,300),"bytes_wire":wire,"bytes_raw":raw,
      "bytes_wire_s":rate*4000,"bytes_raw_s":rate*20000,"requests":req,"req_s":round(rate,2),"pages":pages,"pages_s":3.0,
      "products":uniq+dup,"products_s":round(newp/dt,1),"unique":uniq,"dupes":dup,"unchanged":0,"details":det,"details_s":10.0,
      "errors":err,"errors_by_code":{"challenge":err} if err else {},"backoffs":back,"challenges":err,
      "queue_list":max(0,200-pages),"queue_detail":max(0,5000-det),"eta_s":30.0,"last_error":"challenge" if err else ""}))
    sys.stdout.flush()
print(json.dumps({"t":"event","store":store,"event":"done","msg":f"unique={uniq} details={det}"})); sys.stdout.flush()
