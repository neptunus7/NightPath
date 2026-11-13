from contextlib import closing
import http.client,json,sys,threading,tempfile,unittest
from pathlib import Path
from unittest import mock
from http.server import ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'nowon'/'data_prep'))
import osm_fetch
import serve_nowon

class LocalServerTests(unittest.TestCase):
    def test_source_only_no_autofetch_then_import(self):
        with tempfile.TemporaryDirectory() as temp:
            with mock.patch.object(osm_fetch,'TARGET',Path(temp)/'osm_nowon.json'), mock.patch.object(serve_nowon,'download',side_effect=AssertionError('automatic download should never run')):
                server=ThreadingHTTPServer(('127.0.0.1',0),serve_nowon.Handler)
                thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
                try:
                    port=server.server_port
                    with closing(http.client.HTTPConnection('127.0.0.1',port,timeout=10)) as c:
                        c.request('GET','/nowon/api/osm');r=c.getresponse();fallback=json.loads(r.read())
                    self.assertEqual(r.status,503)  # source-only; missing data is expected
                    self.assertIn('좌표',fallback['error'])
                    new={'elements':[{'type':'way','id':9,'nodes':[1,2],
                        'geometry':[{'lat':37.65,'lon':127.07},{'lat':37.6501,'lon':127.0701}],
                        'tags':{'highway':'footway'}}]}
                    with closing(http.client.HTTPConnection('127.0.0.1',port,timeout=10)) as c:
                        c.request('POST','/nowon/api/osm/import',body=json.dumps(new),headers={
                            'Content-Type':'application/json','Origin':f'http://127.0.0.1:{port}'})
                        r=c.getresponse();body=json.loads(r.read())
                    self.assertEqual(r.status,200)
                    self.assertTrue(body['ok'])
                    self.assertEqual(osm_fetch.cached()['_nightpath_source'],'OpenStreetMap_Manually_Imported_ODbL')
                    with closing(http.client.HTTPConnection('127.0.0.1',port,timeout=10)) as c:
                        c.request('GET','/nowon/api/osm');r=c.getresponse();stored=json.loads(r.read())
                    self.assertEqual(r.status,200)
                    self.assertEqual(len(stored['elements']),1)
                    with closing(http.client.HTTPConnection('127.0.0.1',port,timeout=10)) as c:
                        c.request('GET','/nowon/index.html');r=c.getresponse();html=r.read().decode()
                    self.assertEqual(r.status,200)
                    self.assertIn('최광루트',html)
                    self.assertIn('반경 1km',html)
                finally:server.shutdown();thread.join();server.server_close()

if __name__=='__main__':unittest.main()
