import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGraph} from '../nowon/routing.mjs';
import {computeDestinationRoutes} from '../nowon/free_destination.mjs';

// Public/synthetic test. No real map coordinates or raw NGII/OSM records required.
const CENTER=[37.65,127.07];
const point=(lat,lon)=>({lat,lon});
const A=point(37.6500,127.0700),B=point(37.6500,127.0720),C=point(37.6503,127.0710);
const makeWay=(id,nodes,geometry)=>({type:'way',id,nodes,geometry,tags:{highway:'residential'}});
const graph=buildGraph([makeWay(1,[1,2],[A,B]),makeWay(2,[1,3,2],[A,C,B])],
  [{lat:C.lat,lon:C.lon,category:'ngii_street'},
   {lat:37.65015,lon:127.0705,category:'ngii_street'},
   {lat:37.65015,lon:127.0715,category:'ngii_street'}],CENTER,{urbanOnly:true});
assert.ok(graph.edges.length>0);
const res=computeDestinationRoutes(graph,[A.lat,A.lon],[B.lat,B.lon]);
assert.equal(res.startNode,'1');assert.equal(res.endNode,'2');
assert.ok(res.shortest.distance>0);
assert.ok(res.bright.distance>=res.shortest.distance-.01);
assert.ok(res.bright.distance<=res.shortest.distance*1.35+.01);
assert.equal(res.shortest.ids[0],res.bright.ids[0]);
assert.equal(res.shortest.ids.at(-1),res.bright.ids.at(-1));
assert.ok(res.startSnapDistance<.1&&res.endSnapDistance<.1);
assert.equal(typeof res.samePath,'boolean');
assert.throws(()=>computeDestinationRoutes(graph,[A.lat,A.lon],[A.lat,A.lon]),/같은 도로 노드/);
assert.throws(()=>computeDestinationRoutes(graph,[A.lat,A.lon],[37.68,127.12]),/도착지에서 120m 이내/);
assert.throws(()=>computeDestinationRoutes(graph,[37.68,127.12],[B.lat,B.lon]),/출발지에서 220m 이내/);
const disconnected=buildGraph([makeWay(3,[1,2],[A,B]),makeWay(4,[5,6],[point(37.653,127.074),point(37.653,127.075)])],[],CENTER,{urbanOnly:true});
assert.throws(()=>computeDestinationRoutes(disconnected,[A.lat,A.lon],[37.653,127.074]),/연결되지 않았습니다/);

// Check the complete UI path is wired without modifying the existing two modes.
const app=readFileSync(new URL('../nowon/app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../nowon/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../nowon/style.css',import.meta.url),'utf8');
for(const id of ['tab-destination','destination-panel','pick-destination','reset-destination','destination-status'])assert.match(html,new RegExp(`id="${id}"`));
assert.match(html,/BETA 0\.8\.13\.0/);
assert.match(app,/state\.destinationPick=true/);
assert.match(app,/function previewDestination\(index\)/);
assert.match(app,/function confirmDestination\(\)/);
assert.match(app,/drawRoute\(route\); \/\/ Only selected path/);
assert.match(app,/cancel-destination-selection'\)\.onclick=\(\)=>previewDestination\(selectedIndex\)/);
assert.match(app,/mode==='shop'/);
assert.match(app,/mode==='loop'/);
assert.match(css,/\.nightpath-free-destination/);
assert.match(app,/distanceMeters\(CENTER,destination\)>1200/);
console.log('PASS free destination synthetic graph, snap, disconnect, 35%-detour, two-path UI wiring');
