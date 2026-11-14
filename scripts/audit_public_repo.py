#!/usr/bin/env python3
"""Fail-closed check for accidental release of local coordinates or secrets.
This is a release gate, not a formal security/rights certification.
"""
from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]
ALLOWED_ROOT={'.gitignore','LICENSE','README.md','CHANGELOG.md'}
ALLOWED_NOWON={'index.html','app.mjs','routing.mjs','light_canvas.mjs','store_hours.mjs','store_recommendations.mjs','free_destination.mjs','style.css'}
ALLOWED_PREP={'analyze_ngii_2025.py','build_ngii_road_fallback.py','download_osm.py','osm_fetch.py','osm_xml.py','serve_nowon.py'}
ALLOWED_TESTS={
'confirmed-route-visible-v08127.test.mjs',
'light-grid-sync.test.mjs','light-grid-visible-regression.test.mjs',
'nowon-alternatives.test.mjs','nowon-night-glow.test.mjs','nowon-routing.test.mjs',
'nowon-urban-filter.test.mjs','results-sticky-featured-v08129.test.mjs',
'store-hours-visual.test.mjs','store-route-confirm-v08128.test.mjs',
'free-destination-v08130.test.mjs','free-destination-ui-v08130.test.mjs',
'test_nowon_local_server.py','test_osm_xml.py'}
ALLOWED_DOCS={'BENCHMARK_v0.8.11.md','BUGFIX_LIGHT_TILE_v0.8.12.1.md',
'BUGFIX_SELECTED_ROUTE_v0.8.12.7.md','SHOP_RECOMMENDATION_RULES_v0.8.12.6.md',
'PROJECT_STORY.md','METHOD_AND_LIMITATIONS.md','DATA_POLICY.md',
'THIRD_PARTY_NOTICES.md','PUBLISH_CHECKLIST.md','TESTS.md',
'FREE_DESTINATION_v0.8.13.0.md'}
EXPECTED=(ALLOWED_ROOT|{'nowon/'+x for x in ALLOWED_NOWON}|
{'nowon/data_prep/'+x for x in ALLOWED_PREP}|
{'tests/'+x for x in ALLOWED_TESTS}|
{'docs/'+x for x in ALLOWED_DOCS}|
{'examples/synthetic_route_demo.mjs','scripts/audit_public_repo.py','nowon/data/.gitkeep'})
BLOCK_EXT={'.zip','.7z','.rar','.tar','.gz','.json','.geojson','.csv','.xlsx','.xls','.gpkg','.shp','.shx','.dbf','.prj','.pbf','.osm','.kml','.gpx','.mbtiles','.pmtiles','.sqlite','.png','.jpg','.jpeg','.webp','.gif','.tif','.tiff','.pdf','.mp4','.mov','.exe','.dll','.bin'}
BAD_PATH_PARTS={'src','versions','private','local_data','raw_data','screenshots','.git','__pycache__','node_modules'}
PRIVATE_NAMES={'config.local.js','index.local.html','.env','.env.local'}
# Warning scan. Trigger on values, not ordinary mentions of 'API key' or 'token'.
SECRET_PATTERNS=[
 re.compile(r'(?i)(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*[\"\']?[a-z0-9_\-/+=]{24,}'),
 re.compile(r'(?i)-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----'),
 re.compile(r'(?i)gh[ps]_[A-Za-z0-9_]{30,}'),
 re.compile(r'(?i)github_pat_[A-Za-z0-9_]{25,}')
]
errors=[];seen=set()
for p in ROOT.rglob('*'):
 if not p.is_file():continue
 rel=p.relative_to(ROOT).as_posix()
 if '__pycache__' in p.relative_to(ROOT).parts and p.suffix=='.pyc':continue  # ignored local Python bytecode, not in distributable ZIP
 if any(x in BAD_PATH_PARTS for x in p.relative_to(ROOT).parts):errors.append(f'blocked directory: {rel}')
 if rel not in EXPECTED:errors.append(f'file not allowlisted: {rel}')
 if p.suffix.lower() in BLOCK_EXT:errors.append(f'blocked extension: {rel}')
 if p.name in PRIVATE_NAMES:errors.append(f'private config: {rel}')
 if p.stat().st_size>200_000:errors.append(f'large file: {rel}')
 if rel=='nowon/data/.gitkeep':continue
 try:txt=p.read_text(encoding='utf-8')
 except UnicodeDecodeError:errors.append(f'binary content: {rel}');continue
 for pat in SECRET_PATTERNS:
  if pat.search(txt):errors.append(f'possible embedded credential: {rel}')
 seen.add(rel)
missing=EXPECTED-set(p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file())
if missing:errors.extend(f'missing allowlisted file: {x}' for x in sorted(missing))
print(f'PUBLIC AUDIT: {len(EXPECTED)-len(missing)} allowlisted files checked; {len(errors)} problem(s)')
for e in errors:print(' -',e)
sys.exit(bool(errors))
