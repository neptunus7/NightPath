"""Convert user-supplied NGII 2025 road centerlines to OFFLINE research graph.
NOT an OSM download. NOT a certified pedestrian network.
Requires pyshp and pyproj. Example:
 python nowon/data_prep/build_ngii_road_fallback.py "/path/to/(B010)*zip" --out nowon/data/ngii_roads_unverified.json
"""
import argparse, collections, glob, io, json, math, zipfile
from pathlib import Path
import shapefile
from pyproj import Transformer

CENTER_LAT=37.650555110483
CENTER_LON=127.07420038053
CENTER_X,CENTER_Y=Transformer.from_crs('EPSG:4326','EPSG:5186',always_xy=True).transform(CENTER_LON,CENTER_LAT)
TRANS=Transformer.from_crs('EPSG:5186','EPSG:4326',always_xy=True)
RADIUS=1775

def build(paths):
    elements=[];node_map={};all_ufids=set();filtered=collections.Counter();length_total=0
    def nodeid(point):
        # Exact 1-cm endpoint precision only; no guessed cross-street connectors.
        key=(round(point[0],2),round(point[1],2))
        if key not in node_map:node_map[key]=-len(node_map)-1
        return node_map[key]
    for filepath in sorted(paths):
        with zipfile.ZipFile(filepath) as z:
            layer='N3L_A0020000';required=[layer+ext for ext in ('.shp','.shx','.dbf')]
            if not all(n in z.namelist() for n in required): continue
            r=shapefile.Reader(shp=io.BytesIO(z.read(layer+'.shp')),shx=io.BytesIO(z.read(layer+'.shx')),dbf=io.BytesIO(z.read(layer+'.dbf')),encoding='cp949')
            for record in r.iterShapeRecords():
                d=record.record.as_dict();roadwidth=float(d.get('도로폭') or 0);lanes=int(d.get('차로수') or 0)
                if d.get('자동차전용')!='일반' or roadwidth>40 or lanes>8:
                    filtered['wide_or_restricted']+=1;continue
                pts=record.shape.points
                if len(pts)<2:continue
                if min(math.hypot(x-CENTER_X,y-CENTER_Y) for x,y in pts)>RADIUS+80:
                    # Very long line with vertices outside circle can cross it; rare but keep only if not an obvious far match.
                    filtered['outside']+=1;continue
                ufid=str(d.get('UFID') or '')
                if ufid in all_ufids:filtered['duplicate_ufid']+=1;continue
                all_ufids.add(ufid)
                # Limit extent to a radius; allow 1 segment crossing the 1.775 km clip.
                chunks=[];chunk=[]
                for i,p in enumerate(pts):
                    inrange=math.hypot(p[0]-CENTER_X,p[1]-CENTER_Y)<RADIUS
                    if inrange:
                        if not chunk and i and math.hypot(pts[i-1][0]-CENTER_X,pts[i-1][1]-CENTER_Y)<RADIUS+100:chunk=[pts[i-1]]
                        chunk.append(p)
                    else:
                        if len(chunk):
                            if math.hypot(p[0]-CENTER_X,p[1]-CENTER_Y)<RADIUS+100:chunk.append(p)
                            if len(chunk)>1:chunks.append(chunk)
                            chunk=[]
                if len(chunk)>1:chunks.append(chunk)
                for partno,chunk in enumerate(chunks):
                    # Keep source line work unchanged, do not invent crossings/intersections.
                    ids=[nodeid(p) for p in chunk]; coords=[];dist=0
                    for j,p in enumerate(chunk):
                        lon,lat=TRANS.transform(p[0],p[1]);coords.append({'lat':round(lat,8),'lon':round(lon,8)})
                        if j:dist+=math.dist(p,chunk[j-1])
                    if dist<1.0:continue
                    elements.append({'type':'way','id':-int(len(elements)+1),'nodes':ids,'geometry':coords,
                       'tags':{'highway':'unclassified' if roadwidth<=12 else 'tertiary',
                          'nightpath:source':'NGII_2025_road_centerline','nightpath:pedestrian':'unverified',
                          'nightpath:ufid':ufid,'nightpath:width_m':str(roadwidth),
                          'nightpath:lanes':str(lanes)}})
                    length_total+=dist
    return {'version':0.6,'generator':'NIGHTPATH offline conversion of NGII 2025 road centerline (N3L_A0020000)',
      '_nightpath_source':'NGII_2025_ROAD_CENTERLINES_NOT_OSM',
      '_nightpath_warning':'도로 중심선으로 실제 보행가능 구간, 횡단보도, 사유지, 안전성을 검증하지 않았습니다. 실외 안내용으로 사용 금지.',
      '_nightpath_coverage_radius_m':RADIUS,'elements':elements,
      '_nightpath_stats':{'source_files':len(paths),'ways':len(elements),'nodes':len(node_map),'total_geom_km':round(length_total/1000,1),'filtered':dict(filtered)}}

def main():
    p=argparse.ArgumentParser();p.add_argument('files',nargs='+');p.add_argument('--out',default='nowon/data/ngii_roads_unverified.json');args=p.parse_args()
    paths=[Path(x) for pattern in args.files for x in glob.glob(pattern)]
    out=build(paths);Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    Path(args.out).write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps(out['_nightpath_stats'],ensure_ascii=False,indent=2))
if __name__=='__main__':main()
