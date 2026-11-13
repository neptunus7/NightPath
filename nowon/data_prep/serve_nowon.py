"""Offline-friendly NIGHTPATH local preview.
Serves files and a single cache-backed endpoint, only on 127.0.0.1.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import urllib.parse
import json
import os
import webbrowser
from threading import Timer
from osm_fetch import cached, download, store, valid

ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        path=urllib.parse.urlsplit(self.path)
        if path.path!='/nowon/api/osm':return super().do_GET()
        # PUBLIC SOURCE-ONLY BUILD: data intentionally absent.
        # Do not fetch OSM automatically when a visitor opens the page.
        # Network refresh is only via the explicit refresh=1 action.
        refresh=urllib.parse.parse_qs(path.query).get('refresh',['0'])[0]=='1'
        data=cached()
        fallback=ROOT/'nowon'/'data'/'ngii_roads_unverified.json'
        if refresh:
            try:data,_=download()
            except Exception as e:
                if data is None:
                    try:data=json.loads(fallback.read_text(encoding='utf-8'))
                    except (OSError,ValueError):return self.json_reply({'error':str(e)},503)
        elif data is None:
            try:data=json.loads(fallback.read_text(encoding='utf-8'))
            except (OSError,ValueError):
                # No NGII road file and no OSM cache: explain honestly; do not auto-download.
                return self.json_reply({'error':'공개 코드 전용판: 실제 OSM·NGII 좌표가 포함되어 있지 않습니다. 적법하게 확보한 데이터를 로컬에서 준비해야 합니다.'},503)
        self.json_reply(data)
    def do_POST(self):
        if urllib.parse.urlsplit(self.path).path!='/nowon/api/osm/import':
            return self.json_reply({'error':'not found'},404)
        origin=self.headers.get('Origin','')
        allowed=f'http://127.0.0.1:{self.server.server_port}'
        if origin and origin!=allowed:
            return self.json_reply({'error':'local browser origin only'},403)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length<2 or length>50_000_000:
                return self.json_reply({'error':'invalid size (maximum 50MB)'},413)
            data=json.loads(self.rfile.read(length))
            if not valid(data) or any(el.get('tags',{}).get('nightpath:source')=='NGII_2025_road_centerline' for el in data.get('elements',[])):
                return self.json_reply({'error':'OSM candidate routes only; NGII centreline cannot replace the OSM cache'},400)
            stored=store(data,'OpenStreetMap_Manually_Imported_ODbL')
            return self.json_reply({'ok':True,'elements':len(stored['elements'])})
        except (UnicodeError,ValueError,KeyError,TypeError) as exc:
            return self.json_reply({'error':str(exc)},400)
    def json_reply(self,value,code=200):
        out=json.dumps(value,ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(out)))
        self.end_headers();self.wfile.write(out)

if __name__=='__main__':
    server = None
    for port in (8000, 8002, 8003):
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
            break
        except OSError:
            continue
    if server is None:
        raise SystemExit('ERROR: ports 8000, 8002 and 8003 are unavailable. Please close old NIGHTPATH terminals.')

    url = f'http://127.0.0.1:{server.server_port}/nowon/index.html'
    print(f'NIGHTPATH v0.8.12.9 public source-only preview - {url}', flush=True)
    print('Keep this window open while using NIGHTPATH.', flush=True)
    print('OSM cache location: nowon/data/osm_nowon.json', flush=True)
    print('PUBLIC SOURCE-ONLY: no NGII fallback or OSM dataset is bundled; do not treat this as a live demo.', flush=True)

    # Open only AFTER the HTTP server binds. Disable in automated tests.
    if os.environ.get('NIGHTPATH_NO_BROWSER') != '1':
        timer = Timer(1.0, lambda: webbrowser.open(url))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Server stopped.')
    finally:
        server.server_close()
