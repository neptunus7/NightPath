import io, json, sys, tempfile, unittest
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'nowon'/'data_prep'))
import osm_fetch
from osm_xml import as_elements

SAMPLE=b'''<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="fixture">
<node id="1" lat="37.650000" lon="127.070000" />
<node id="2" lat="37.650500" lon="127.070500" />
<node id="3" lat="37.651000" lon="127.070800"><tag k="shop" v="convenience"/><tag k="name" v="Example"/></node>
<node id="4" lat="37.651500" lon="127.071000"><tag k="highway" v="street_lamp"/></node>
<way id="42"><nd ref="1"/><nd ref="2"/><nd ref="3"/><tag k="highway" v="footway"/></way>
<way id="43"><nd ref="2"/><nd ref="3"/><tag k="shop" v="convenience"/><tag k="name" v="Shop way"/></way>
<way id="44"><nd ref="1"/><nd ref="3"/><tag k="highway" v="motorway"/></way>
</osm>'''

class RealOsmFallbackTests(unittest.TestCase):
    def test_xml_parser_includes_roads_lights_shops_but_not_motorway(self):
        data=as_elements(SAMPLE)
        self.assertTrue(osm_fetch.valid(data))
        ids={w['id'] for w in data['elements'] if w['type']=='way'}
        self.assertEqual(ids,{42,43})
        self.assertEqual(len([e for e in data['elements'] if e['type']=='node']),2)
        self.assertEqual(next(e for e in data['elements'] if e['id']==42)['nodes'],[1,2,3])
        self.assertIn('center',next(e for e in data['elements'] if e['id']==43))

    def test_invalid_xml_rejected(self):
        with self.assertRaises(ValueError):as_elements(b'<html/>')
        with self.assertRaises(ValueError):as_elements(b'<osm><node/></osm>')

    def test_official_osm_download_and_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'osm_nowon.json'
            with mock.patch.object(osm_fetch,'TARGET',path):
                with mock.patch.object(osm_fetch,'_get_xml',return_value=SAMPLE):
                    contents,server=osm_fetch.download()
                self.assertIn('api.openstreetmap.org',server)
                self.assertEqual(osm_fetch.cached()['elements'],contents['elements'])
                self.assertEqual(contents['_nightpath_source'],'OpenStreetMap_Official_API_0.6_ODbL')

    def test_official_failure_falls_back_to_overpass(self):
        data=as_elements(SAMPLE)
        with tempfile.TemporaryDirectory() as temp:
            with mock.patch.object(osm_fetch,'TARGET',Path(temp)/'osm_nowon.json'):
                with mock.patch.object(osm_fetch,'_get_xml',side_effect=RuntimeError('offline')):
                    with mock.patch.object(osm_fetch,'_overpass',return_value=(data,'https://overpass.example')):
                        payload,url=osm_fetch.download()
                        self.assertEqual(url,'https://overpass.example')
                        self.assertEqual(payload['_nightpath_source'],'OpenStreetMap_Overpass_ODbL')

if __name__=='__main__':unittest.main()
