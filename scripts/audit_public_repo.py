#!/usr/bin/env python3
"""Public repository release check for NightPath v0.8.13.0 GitHub Pages.

Checks only recognized paths, synthetic markers, attribution metadata, file sizes,
common secret patterns, and presence of required files. This is not proof of
origin, rights clearance, absence of every secret, or Git history safety.
"""
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
ALLOWED_ROOT = {'.gitignore', 'LICENSE', 'README.md', 'CHANGELOG.md', 'nightpath-readme-screenshot.png'}
ALLOWED_NOWON = {'index.html','app.mjs','routing.mjs','light_canvas.mjs',
                 'store_hours.mjs','store_recommendations.mjs','free_destination.mjs','style.css'}
ALLOWED_PREP = {'analyze_ngii_2025.py','build_ngii_road_fallback.py',
                'download_osm.py','osm_fetch.py','osm_xml.py','serve_nowon.py'}
ALLOWED_TESTS = {
  'confirmed-route-visible-v08127.test.mjs','light-grid-sync.test.mjs',
  'light-grid-visible-regression.test.mjs','nowon-alternatives.test.mjs',
  'nowon-night-glow.test.mjs','nowon-routing.test.mjs','nowon-urban-filter.test.mjs',
  'results-sticky-featured-v08129.test.mjs','store-hours-visual.test.mjs',
  'store-route-confirm-v08128.test.mjs','free-destination-v08130.test.mjs',
  'free-destination-ui-v08130.test.mjs','test_nowon_local_server.py','test_osm_xml.py'
}
ALLOWED_DOCS = {'BENCHMARK_v0.8.11.md','BUGFIX_LIGHT_TILE_v0.8.12.1.md',
                'BUGFIX_SELECTED_ROUTE_v0.8.12.7.md','SHOP_RECOMMENDATION_RULES_v0.8.12.6.md',
                'PROJECT_STORY.md','METHOD_AND_LIMITATIONS.md','DATA_POLICY.md',
                'THIRD_PARTY_NOTICES.md','PUBLISH_CHECKLIST.md','TESTS.md',
                'FREE_DESTINATION_v0.8.13.0.md','PAGES_README.md','PAGES_DATA_LICENSE.md',
                'app.mjs','index.html','routing.mjs','light_canvas.mjs',
                'free_destination.mjs','store_hours.mjs','store_recommendations.mjs','style.css'}
ALLOWED_PAGES_DATA = {'lights_synthetic.json','extra_lights_synthetic.json',
                      'safety_synthetic.json','osm_nowon.json'}
EXPECTED = (
  ALLOWED_ROOT |
  {'nowon/' + n for n in ALLOWED_NOWON} |
  {'nowon/data_prep/' + n for n in ALLOWED_PREP} |
  {'tests/' + n for n in ALLOWED_TESTS} |
  {'docs/' + n for n in ALLOWED_DOCS} |
  {'docs/data/' + n for n in ALLOWED_PAGES_DATA} |
  {'examples/synthetic_route_demo.mjs','scripts/audit_public_repo.py',
   'nowon/data/.gitkeep'}
)
BANNED_PARTS = {'.git','src','versions','private','local_data','raw_data','screenshots',
                '__pycache__','node_modules'}
BANNED_EXT = {'.zip','.7z','.rar','.tar','.gz','.geojson','.csv','.xls','.xlsx',
              '.gpkg','.shp','.shx','.dbf','.prj','.pbf','.osm','.kml','.gpx',
              '.mbtiles','.pmtiles','.sqlite','.tif','.tiff','.pdf','.mp4','.mov',
              '.exe','.dll','.pem','.key'}
PRIVATE_NAMES = {'config.local.js','index.local.html','.env','.env.local'}
SECRET_PATTERNS = [
  re.compile(r'(?i)(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*["\']?[a-z0-9_\-/+=]{24,}'),
  re.compile(r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----', re.I),
  re.compile(r'gh[ps]_[A-Za-z0-9_]{30,}'),
  re.compile(r'github_pat_[A-Za-z0-9_]{25,}')
]
errors = []
found = set()
for p in ROOT.rglob('*'):
    if not p.is_file():
        continue
    rel = p.relative_to(ROOT).as_posix()
    if '__pycache__' in p.relative_to(ROOT).parts and p.suffix=='.pyc':
        continue  # Python local test cache, not tracked; Git ZIP omits it
    found.add(rel)
    if rel not in EXPECTED:
        errors.append(f'not allowlisted: {rel}')
        continue
    if any(part in BANNED_PARTS for part in p.relative_to(ROOT).parts):
        errors.append(f'blocked directory: {rel}')
    if p.name in PRIVATE_NAMES or p.suffix.lower() in BANNED_EXT:
        errors.append(f'blocked private name/extension: {rel}')
    allowed_binary = rel == 'nightpath-readme-screenshot.png'
    allowed_json = rel.startswith('docs/data/') and p.name in ALLOWED_PAGES_DATA
    size_limit = 2_500_000 if allowed_json else 2_000_000 if allowed_binary else 200_000
    if p.stat().st_size > size_limit:
        errors.append(f'unexpected large file: {rel}')
    if rel == 'nowon/data/.gitkeep':
        continue
    if allowed_binary:
        if p.read_bytes()[:8] != b'\x89PNG\r\n\x1a\n':
            errors.append(f'expected PNG: {rel}')
        continue
    try:
        txt = p.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        errors.append(f'binary content: {rel}')
        continue
    for pat in SECRET_PATTERNS:
        if pat.search(txt):
            errors.append(f'possible credential: {rel}')
    if allowed_json:
        try:
            obj = json.loads(txt)
        except ValueError:
            errors.append(f'invalid JSON: {rel}')
            continue
        license = str(obj.get('_license', ''))
        if 'odbl/1-0' not in license:
            errors.append(f'ODbL attribution missing: {rel}')
        if rel.endswith('osm_nowon.json'):
            if 'OpenStreetMap' not in str(obj.get('_source','')) or not isinstance(obj.get('elements'), list):
                errors.append(f'OSM provenance marker/element list missing: {rel}')
        else:
            if obj.get('_synthetic') is not True:
                errors.append(f'synthetic flag missing: {rel}')
            if 'lights' in obj:
                prefix = 'DEMO-OTHER-' if rel.endswith('extra_lights_synthetic.json') else 'DEMO-LAMP-'
                if not isinstance(obj['lights'], list) or any(not str(x.get('id','')).startswith(prefix) or
                  not any(word in str(x.get('source','')) for word in ('가상','합성','시연'))
                  for x in obj['lights']):
                    errors.append(f'non-demo light record: {rel}')
            if rel.endswith('safety_synthetic.json'):
                if any('가상' not in str(x.get('properties',{}).get('source',''))
                       for x in obj.get('facilities', [])):
                    errors.append(f'non-demo safety facility: {rel}')
missing = EXPECTED - found
errors.extend(f'missing required file: {name}' for name in sorted(missing))
print(f'PUBLIC AUDIT: checked {len(found)} files; {len(errors)} issue(s)')
for error in errors:
    print(' -', error)
print('NOTE: This checks the extracted snapshot only, not Git commit history or data provenance.')
sys.exit(bool(errors))
