"""Transform OSM API 0.6 XML into NIGHTPATH's local Overpass-like way geometry.

Source is OpenStreetMap contributors, ODbL. Do not mix with NGII data origin.
This is a mapped walking-CANDIDATE network, not a field-verified accessible route.
"""
from xml.etree import ElementTree as ET

WALK_CLASSES={
    'footway','path','pedestrian','living_street','residential','service',
    'tertiary','unclassified','steps','track','cycleway'
}

def as_elements(xml_content):
    if isinstance(xml_content,bytes):
        raw=xml_content
    else:
        raw=xml_content.encode('utf-8')
    if len(raw)>70_000_000:raise ValueError('OSM XML 70MB 초과')
    root=ET.fromstring(raw)
    if root.tag!='osm':raise ValueError('OSM XML 루트가 아닙니다.')
    node_index={}
    node_tags={}
    for n in root.iter('node'):
        try: nid=int(n.attrib['id']);lat=float(n.attrib['lat']);lon=float(n.attrib['lon'])
        except (ValueError,KeyError):continue
        node_index[nid]=(lat,lon)
        tags={t.attrib.get('k'):t.attrib.get('v') for t in n.findall('tag')}
        if tags and (tags.get('shop')=='convenience' or tags.get('highway')=='street_lamp'):
            node_tags[nid]=tags
    elements=[]
    for nid,tags in node_tags.items():
        lat,lon=node_index[nid]
        elements.append({'type':'node','id':nid,'lat':lat,'lon':lon,'tags':tags})
    for way in root.iter('way'):
        tags={t.attrib.get('k'):t.attrib.get('v') for t in way.findall('tag')}
        if not (tags.get('highway') in WALK_CLASSES or tags.get('shop')=='convenience'):
            continue
        ids=[];geometry=[]
        for nd in way.findall('nd'):
            try:ref=int(nd.attrib['ref']);lat,lon=node_index[ref]
            except (KeyError,ValueError):continue
            ids.append(ref);geometry.append({'lat':lat,'lon':lon})
        if len(ids)<2:continue
        try:wid=int(way.attrib['id'])
        except (KeyError,ValueError):continue
        item={'type':'way','id':wid,'nodes':ids,'geometry':geometry,'tags':tags}
        if tags.get('shop')=='convenience':
            item['center']={'lat':sum(p['lat'] for p in geometry)/len(geometry),
                            'lon':sum(p['lon'] for p in geometry)/len(geometry)}
        elements.append(item)
    if not any(e.get('type')=='way' and e.get('tags',{}).get('highway') in WALK_CLASSES for e in elements):
        raise ValueError('보행 후보 도로 구간이 없는 OSM XML입니다.')
    return {'version':0.6,'_nightpath_source':'OpenStreetMap_XML_ODbL',
            '_nightpath_warning':'OSM 도로 데이터는 실측 보행 안전·보도·횡단보도 연결·현재 출입 허용 여부를 보장하지 않습니다.',
            'elements':elements}
