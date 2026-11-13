"""Single-user local OSM walking-candidate snapshot fetch/cache.

Preferred route: one official OSM API 0.6 bbox (public export endpoint).
Fallback route: Overpass if the official map endpoint fails.
Nothing is downloaded on app boot; only a user-triggered refresh does this.
Never store a Kakao routing API response here.
"""
from pathlib import Path
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from osm_xml import as_elements

CENTER=(37.650555110483,127.07420038053)
# 1km analysis circle, plus 550m buffer so the route finder is not clipped.
RADIUS_M=1550
D_LAT=RADIUS_M/111195
D_LON=RADIUS_M/(111195*0.792)  # representative cos(latitude) near Nowon
BBOX=(CENTER[1]-D_LON,CENTER[0]-D_LAT,CENTER[1]+D_LON,CENTER[0]+D_LAT)
OSM_MAP='https://api.openstreetmap.org/api/0.6/map'
QUERY=f'''[out:json][timeout:50];(way["highway"~"^(footway|path|pedestrian|living_street|residential|service|tertiary|unclassified|steps|track|cycleway)$"](around:1550,{CENTER[0]},{CENTER[1]});node["shop"="convenience"](around:1550,{CENTER[0]},{CENTER[1]});way["shop"="convenience"](around:1550,{CENTER[0]},{CENTER[1]});node["highway"="street_lamp"](around:1550,{CENTER[0]},{CENTER[1]}););out center geom;'''
ENDPOINTS=(
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
)
TARGET=Path(__file__).resolve().parent.parent/'data'/'osm_nowon.json'
USER_AGENT='NIGHTPATH-Nowon-research/0.8.4 (personal local preview)'

def valid(data):
    return (isinstance(data,dict) and isinstance(data.get('elements'),list)
        and any(e.get('type')=='way' and len(e.get('nodes') or [])>=2
                and len(e.get('nodes') or [])==len(e.get('geometry') or [])
                for e in data['elements']))

def cached():
    try:
        data=json.loads(TARGET.read_text(encoding='utf-8'))
        if valid(data):return data
    except (OSError, ValueError, UnicodeError):pass
    return None

def store(data,source=None):
    if not valid(data):raise ValueError('좌표 geometry가 있는 OSM 도로 구간이 필요합니다.')
    # Drop raw user-origin metadata; do not store or redistribute Kakao route data.
    data=dict(data)
    if source:data['_nightpath_source']=source
    data['_nightpath_cached_at']=datetime.now(timezone.utc).isoformat()
    TARGET.parent.mkdir(parents=True,exist_ok=True)
    tmp=TARGET.with_suffix('.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    tmp.replace(TARGET)
    return data

def _get_xml(bbox,timeout=32):
    bounds=','.join(f'{x:.7f}' for x in bbox)
    request=urllib.request.Request(f'{OSM_MAP}?bbox={bounds}',headers={
        'User-Agent':USER_AGENT,'Accept':'text/xml, application/xml'})
    with urllib.request.urlopen(request,timeout=timeout) as response:
        content_len=int(response.headers.get('Content-Length','0') or 0)
        if content_len>70_000_000:raise ValueError('공식 OSM 지도가 너무 큽니다.')
        contents=response.read(70_000_001)
        if len(contents)>70_000_000:raise ValueError('공식 OSM 응답이 너무 큽니다.')
    return contents

def _official_osm():
    # A *single* moderate bbox request, rather than many requests to public infrastructure.
    # If region is too large, export a smaller .osm via OSM's official map UI and import it.
    return as_elements(_get_xml(BBOX))

def _overpass():
    failures=[]
    payload=urllib.parse.urlencode({'data':QUERY}).encode('utf-8')
    for i,host in enumerate(ENDPOINTS):
        try:
            request=urllib.request.Request(host,payload,headers={
                'User-Agent':USER_AGENT,'Accept':'application/json',
                'Content-Type':'application/x-www-form-urlencoded'},method='POST')
            with urllib.request.urlopen(request,timeout=(24,18,14)[i]) as response:
                if int(response.headers.get('Content-Length','0'))>60_000_000:
                    raise ValueError('OSM 응답이 너무 큽니다.')
                data=json.load(response)
            if not valid(data):raise ValueError('도로 geometry가 없는 응답')
            return data,host
        except Exception as error:
            failures.append(f'{urllib.parse.urlparse(host).netloc}: {error}')
    raise RuntimeError('Overpass 조회 실패: '+' | '.join(failures))

def download():
    errors=[]
    try:
        data=_official_osm()
        return store(data,'OpenStreetMap_Official_API_0.6_ODbL'),OSM_MAP
    except Exception as e:
        errors.append(f'OSM 공식 API: {e}')
    try:
        data,host=_overpass()
        return store(data,'OpenStreetMap_Overpass_ODbL'),host
    except Exception as e:errors.append(str(e))
    raise RuntimeError('OSM 새로고침 실패: '+' | '.join(errors))
