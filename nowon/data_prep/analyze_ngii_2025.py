"""NIGHTPATH v0.8.2: extract NGII digital map V2.0 C0220000 point lights and audit against other datasets.
All counts spatial distances on EPSG:5186, WGS84 maps.
"""
from __future__ import annotations
from pathlib import Path
from collections import Counter
from dataclasses import dataclass
from collections import defaultdict
import csv, json, math, hashlib, zipfile, io, argparse
import shapefile
import numpy as np
from pyproj import CRS, Transformer
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import maximum_bipartite_matching
from shapely.geometry import box,Point
from shapely.ops import unary_union
from shapely import contains_xy

parser=argparse.ArgumentParser(description='NIGHTPATH NGII 2025 C022 audit (requires 8 download ZIPs, IoT CSV, 2022 safety GeoJSON)')
parser.add_argument('--zipdir',type=Path,required=True,help='directory holding downloaded (B010)* 수치지도 ZIPs')
parser.add_argument('--iot',type=Path,required=True,help='NOWON_SMART_LIGHT_2026.05.04-05.10.csv')
parser.add_argument('--safety',type=Path,required=True,help='pilot_1km_security_lights_2022.geojson')
parser.add_argument('--out',type=Path,required=True,help='output directory for converted GeoJSON/JSON reports')
args=parser.parse_args()
SRC=sorted(args.zipdir.glob('(B010)*수치지도*zip'))
if len(SRC)==0:raise SystemExit('No (B010) 수치지도 ZIPs in --zipdir')
OUT=args.out
OUT.mkdir(parents=True,exist_ok=True)
CENTER=(37.650555110483,127.07420038053)
WGS2K=Transformer.from_crs('EPSG:4326','EPSG:5186',always_xy=True)
K2WGS=Transformer.from_crs('EPSG:5186','EPSG:4326',always_xy=True)
CX,CY=WGS2K.transform(CENTER[1],CENTER[0])

# Read shapefile inside archive directly, no insecure extraction to filesystem.
def shp(z,basename):
  return shapefile.Reader(shp=io.BytesIO(z.read(basename+'.shp')), shx=io.BytesIO(z.read(basename+'.shx')),dbf=io.BytesIO(z.read(basename+'.dbf')),encoding='cp949')

records=[];tileinfo=[];footprints=[]
for archive in SRC:
  with zipfile.ZipFile(archive) as z:
    shpfiles=[n for n in z.namelist() if n.endswith('.shp')]
    key=next(n[:-4] for n in shpfiles if n.endswith('A0010000.shp'))
    base=shp(z,key)
    crs=CRS.from_wkt(z.read(key+'.prj').decode())
    assert crs.to_epsg()==5186,(archive,crs.to_epsg())
    xmin,ymin,xmax,ymax=base.bbox
    polygon=box(xmin,ymin,xmax,ymax)
    info={"tile":archive.name.split('_')[1],"filename":archive.name,"crs":"EPSG:5186","extent_epsg5186":[xmin,ymin,xmax,ymax],"has_lights":any(n.endswith('C0220000.shp') for n in shpfiles)}
    if info['has_lights']:
      footprints.append(polygon)
      key=next(n[:-4] for n in shpfiles if n.endswith('C0220000.shp'))
      reader=shp(z,key)
      info['light_records']=len(reader)
      info['types']={}
      for idx,item in enumerate(reader.iterShapeRecords()):
        xy=item.shape.points[0]
        latlon=K2WGS.transform(*xy)
        type_name=item.record[0]
        id_name=item.record[1]
        radius=math.hypot(xy[0]-CX,xy[1]-CY)
        records.append({"id":id_name,"type":type_name,"tile":info['tile'],"lon":latlon[0],"lat":latlon[1],"x":xy[0],"y":xy[1],"distance_m":radius})
      info['types']=dict(Counter(r['type'] for r in records if r['tile']==info['tile']))
    tileinfo.append(info)

coverage=unary_union(footprints)
circle500=Point(CX,CY).buffer(500,resolution=256)
circle1000=Point(CX,CY).buffer(1000,resolution=256)
summary={
    'center_latlon':list(CENTER),
    'input_archive_count':len(SRC),
    'tiles_with_lights':len(footprints),
    'distinct_lights':len(records),
    'types':dict(Counter(r['type'] for r in records)),
    'radial':{str(rad):sum(r['distance_m']<=rad for r in records) for rad in (250,500,750,1000)},
    'distinct_ufid':len(set(r['id'] for r in records)),
    'distinct_coord_cm':len(set((round(r['x'],2),round(r['y'],2)) for r in records)),
    'coverage_area_km2':coverage.area/1e6,
    'coverage_500m_fraction':coverage.intersection(circle500).area/circle500.area,
    'coverage_1km_fraction':coverage.intersection(circle1000).area/circle1000.area,
    'tile_info':tileinfo
}

# Read public Seoul IoT observation data. Keep no raw serial numbers in output.
iot_src=args.iot
iot_by_id={}
with iot_src.open(encoding='cp949',newline='') as file:
    reader=csv.reader(file)
    next(reader)
    for row in reader:
        if len(row)<8:continue
        dev=row[2].strip()
        try:lat=float(row[3]);lon=float(row[4])
        except:continue
        if not dev or not 36<lat<39 or not 125<lon<129:continue
        if dev not in iot_by_id or row[7]>iot_by_id[dev]['ts']:
            iot_by_id[dev]={'lat':lat,'lon':lon,'ts':row[7],'id':'iot-'+hashlib.sha256(dev.encode()).hexdigest()[:12]}
iot=[]
for v in iot_by_id.values():
    x,y=WGS2K.transform(v['lon'],v['lat']);d=math.hypot(x-CX,y-CY)
    if d<=1000:
        v={**v,'x':x,'y':y,'distance_m':d,'in_coverage':coverage.covers(Point(x,y))};iot.append(v)

# 2022 investigation data, 38 records, 37 coords
safety_src=args.safety
features=json.loads(safety_src.read_text(encoding='utf-8'))['features']
safety=[]
for feat in features:
    lon,lat=feat['geometry']['coordinates']; x,y=WGS2K.transform(lon,lat)
    safety.append({'id':feat['properties'].get('facility_id'), 'lon':lon,'lat':lat,'x':x,'y':y,
                   'in_coverage':coverage.covers(Point(x,y))})

def match_summary(a,b,side_name_a,side_name_b):
    axy=np.asarray([(d['x'],d['y']) for d in a]);bxy=np.asarray([(d['x'],d['y']) for d in b]);
    if len(a)==0 or len(b)==0:
       return {}
    tree=cKDTree(bxy)
    distances,indices=tree.query(axy)
    data={'source_A':side_name_a,'source_B':side_name_b,'total_A':len(a),'total_B':len(b), 'median_nearest_m':round(float(np.median(distances)),2), 'nearest':{str(r):int((distances<=r).sum()) for r in [3,5,10,20,30]},'unmatched_20m':int((distances>20).sum())}
    for r in (5,10,20):
        neighbors=tree.query_ball_point(axy,r)
        rows=[];cols=[]
        for i,matches in enumerate(neighbors):
            rows.extend([i]*len(matches));cols.extend(matches)
        if rows:
            mat=coo_matrix((np.ones(len(rows)),(rows,cols)),shape=(len(a),len(b))).tocsr()
            mm=maximum_bipartite_matching(mat,perm_type='row')
            unique=int((mm>=0).sum())
        else:unique=0
        data[f'one_to_one_{r}m']=unique
    return data

ngii_records=records
iot_within=[d for d in iot if d['in_coverage']]
safety_within=[d for d in safety if d['in_coverage']]
summary['iot']={'total_1km':len(iot),'inside_ngii_footprint':len(iot_within)}
summary['safety']={'total_1km':len(safety),'unique_coord_1km':len(set((round(p['x'],2),round(p['y'],2)) for p in safety)),'inside_ngii_footprint':len(safety_within)}
summary['matching']={
  'ngii_to_iot':match_summary(ngii_records,iot_within,'2025 NGII C022','2026 IoT inside tiles'),
  'iot_to_ngii':match_summary(iot_within,ngii_records,'2026 IoT inside tiles','2025 NGII C022'),
  'safety_to_ngii':match_summary(safety_within,ngii_records,'2022 안전시설물 inside tiles','2025 NGII C022'),
}

def point_feature(rec):
    return {'type':'Feature','geometry':{'type':'Point','coordinates':[round(rec['lon'],8),round(rec['lat'],8)]},
            'properties':{'id':rec['id'],'facility_type':rec['type'], 'tile':rec['tile'],
                          'survey_year_in_filename':2025,'source':'국토지리정보원 수치지도 V2.0 C0220000',
                          'validation':'지도 원천시설(점등여부·최신성 미확인)'}}

def geojson(path,features):
    path.write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
geojson(OUT/'ngii_2025_C022_4tiles_1110.geojson',[point_feature(r) for r in records])
geojson(OUT/'ngii_2025_C022_security_750.geojson',[point_feature(r) for r in records if r['type']=='보안(방범)등'])
geojson(OUT/'ngii_2025_C022_street_360.geojson',[point_feature(r) for r in records if r['type']=='가로등'])
geojson(OUT/'ngii_2025_C022_500m_873.geojson',[point_feature(r) for r in records if r['distance_m']<=500])
from shapely.geometry import mapping
from shapely.ops import transform
coverage_ll=transform(lambda x,y,z=None: K2WGS.transform(x,y),coverage)
geojson(OUT/'ngii_4tiles_coverage.geojson',[{'type':'Feature','geometry':mapping(coverage_ll),'properties':{'source':'NGII 4 fine-scale tiles','coverage_not_full_1km':True}}])
(OUT/'NGII_C022_AUDIT.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

# Portable route-model input. The existing graph uses lat/lon and category.
app_records=[{'id':r['id'],'lat':round(r['lat'],8),'lon':round(r['lon'],8),
             'category':'ngii_street' if r['type']=='가로등' else 'ngii_security',
             'facilityType':r['type'], 'source':'국토지리정보원 수치지도 V2.0 (2025 파일)',
             'confidence':'원천 지도상 조명 위치, 점등·현황 미검증; 범위 제한'} for r in records]
(OUT/'lights_ngii_2025.json').write_text(json.dumps({'schema':'NIGHTPATH-NGII-C022-v1','lights':app_records,'coverage':mapping(coverage_ll),
    'info':{'total':len(app_records),'types':summary['types'],'coverage_500m_fraction':summary['coverage_500m_fraction'],'coverage_1km_fraction':summary['coverage_1km_fraction']}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')

report=f'''# NIGHTPATH v0.8.2 — 국토지리정보원 수치지도 조명(C0220000) 교차검증

검증일: 2026-11-11. 노원구 중계로 233 임시 대표 위치 {CENTER[0]:.9f}, {CENTER[1]:.9f} 기준.

## 결론
- 사용자가 올린 ZIP {len(SRC)}개 중 **세부 도엽 4개에 조명(C0220000) 포인트 존재**, 나머지 광역 도엽 4개에는 해당 레이어가 포함되지 않음. 레이어 누락은 실물 조명 부재가 아님.
- **1,110개** 조명 위치 피처, 가로등 **360개**, 보안(방범)등 **750개**. UFID {summary['distinct_ufid']:,}개, 1cm 좌표 정밀도 기준 위치 {summary['distinct_coord_cm']:,}개로 파일 내 동일좌표 중복 없음.
- 기준점 **500m 이내 873개**, 250m 이내 239개. 다만 이 네 도엽은 기준점 주변 한정 구역만 덮으므로 **500m 원의 약 {100*summary['coverage_500m_fraction']:.1f}%, 1km 원의 약 {100*summary['coverage_1km_fraction']:.1f}%** 면적만 커버. 나머지 영역의 조명 수는 아직 미확인. 반경 1km 내 1,110개는 **전수 개수 아님**.
- 좌표계는 **EPSG:5186**, 변환된 파일은 **WGS84(EPSG:4326)**; 원본 속성: `구분`, `UFID`.
- ZIP 파일명에는 **2025년**이 들어 있음. S-MAP에서 안내한 2024년 원천지도와 동일 버전이라고 단정하면 안 됨. 개별 현장조사일·설치상태·점등정보는 없음.

## 기존 데이터와 교차 검증
- 2026-05-04~08 노원구 스마트보안등 IoT 1km 내 총 **{len(iot)}개** 고유 기기 시리얼, 그중 이번 4도엽 범위 안 **{len(iot_within)}개**. 시설 대수와 일대일 매핑이 확인된 건 아님.
- 2022 안심귀갓길 보안등 1km 내 기록 **{len(safety)}건**(중복 위치 포함), 이번 도엽 범위 안 **{len(safety_within)}건**.

| 비교 방향 | 기준 건수 | 5m 이내 | 10m 이내 | 20m 이내 | 20m 일대일 최대 매칭 |
|---|---:|---:|---:|---:|---:|
| NGII 조명 → IoT 기기(도엽 내) | {len(records):,} | {summary['matching']['ngii_to_iot']['nearest']['5']} | {summary['matching']['ngii_to_iot']['nearest']['10']} | {summary['matching']['ngii_to_iot']['nearest']['20']} | {summary['matching']['ngii_to_iot']['one_to_one_20m']} |
| IoT 기기 → NGII 조명 | {len(iot_within):,} | {summary['matching']['iot_to_ngii']['nearest']['5']} | {summary['matching']['iot_to_ngii']['nearest']['10']} | {summary['matching']['iot_to_ngii']['nearest']['20']} | {summary['matching']['iot_to_ngii']['one_to_one_20m']} |
| 안심귀갓길 → NGII 조명(도엽 내) | {len(safety_within)} | {summary['matching']['safety_to_ngii']['nearest']['5']} | {summary['matching']['safety_to_ngii']['nearest']['10']} | {summary['matching']['safety_to_ngii']['nearest']['20']} | {summary['matching']['safety_to_ngii']['one_to_one_20m']} |

위의 근접 결과는 같은 실물 시설임을 확정하지 않으며, 기준 자료의 위치 정확도·시설 종류·수집 시점에 따라 중복 가능성이 존재.

## 파일 목록
- `ngii_2025_C022_4tiles_1110.geojson`: 1,110 조명 피처
- `ngii_2025_C022_security_750.geojson`: 보안(방범)등
- `ngii_2025_C022_street_360.geojson`: 가로등
- `ngii_2025_C022_500m_873.geojson`: 반경 500m 내 조명 피처(도엽 내만)
- `ngii_4tiles_coverage.geojson`: 세부 도엽 4개 커버리지 경계
- `lights_ngii_2025.json`: NIGHTPATH 연구용 지도 입력 JSON
- `NGII_C022_AUDIT.json`: 원천 도엽·개수·교차검증 상세

## 주의
- 도엽에 표시된 조명 위치는 도로에 실제 조도가 있다는 증거가 아니며, 공원·산책로 등 영역의 전수성이 확인되지 않음.
- IoT와 NGII 좌표 단순 합산 = 실제 조명 대수 아님.
- 향후 30분 산책/편의점 최적 경로에 쓸 경우 조명 근접도만 추정하고 밝기·안전을 보증하지 않으며, 데이터가 없는 영역을 어둡다고 분류하지 않음.
- 원본 국토정보플랫폼 다운로드 신청 화면 준수사항 확인. 공개 배포 시 자료 이용조건과 출처 표기 확인. 서울시 S-MAP 레이어의 이용안내가 국토지리정보원 원본 이용조건을 자동 대체하지 않음.
'''
(OUT/'NGII_C022_REPORT.md').write_text(report,encoding='utf-8')
print(report)
