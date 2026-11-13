import assert from 'node:assert/strict';
import {buildGraph,distanceMeters,nearestNode,findRoute,brightestWithinDetour,recommendLoop,recommendStores,osmElementsToStores,lightRadius,LIGHT_PROFILES} from '../nowon/routing.mjs';
const C=[37.650555,127.0742],N=8,spacing=.0019;
let elements=[],id=100;
const p=(i,j)=>({lat:C[0]+(i-3.5)*spacing,lon:C[1]+(j-3.5)*spacing});
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const current=i*N+j+1;
  if(j<N-1){elements.push({id:id++,type:'way',nodes:[current,current+1],geometry:[p(i,j),p(i,j+1)],tags:{highway:'residential'}});}
  if(i<N-1){elements.push({id:id++,type:'way',nodes:[current,current+N],geometry:[p(i,j),p(i+1,j)],tags:{highway:'footway'}});}
}
const lights=[{...p(3,3),category:'iot'},{...p(3,4),category:'iot'}];
const g=buildGraph(elements,lights,C);
assert.equal(g.nodes.size,N*N);assert.equal(g.edges.length,2*N*(N-1));
const a=nearestNode(g,[p(3,3).lat,p(3,3).lon]);assert.ok(a);
const b=nearestNode(g,[p(4,4).lat,p(4,4).lon]);assert.ok(b);
const r=findRoute(g,a.id,b.id,0);assert.ok(r);assert.ok(r.distance>250);
const choice=brightestWithinDetour(g,a.id,b.id);assert.ok(choice.route.distance<=choice.shortest.distance*1.35);
const loop=recommendLoop(g,a.id,30);assert.ok(loop&&loop.coords.length>1);
assert.equal(loop.kind,'loop');
assert.equal(loop.ids[0],loop.ids.at(-1));
assert.equal(loop.repeat,0);
assert.equal(loop.uTurns,0);
assert.equal(new Set(loop.ids.slice(0,-1)).size,loop.ids.length-1);
assert.equal(lightRadius('ngii_street'),15);
assert.equal(lightRadius('ngii_security'),8);
assert.equal(lightRadius('ngii_street','late'),11);
assert.equal(lightRadius('ngii_security','late'),6);
const shops=osmElementsToStores([{type:'node',id:123,lat:p(4,4).lat,lon:p(4,4).lon,tags:{shop:'convenience',name:'테스트점'}}]);
const ranking=recommendStores(g,a.id,shops,2000);assert.equal(ranking.length,1);
assert.ok(distanceMeters(C,[p(3,3).lat,p(3,3).lon])>0);
console.log('PASS: graph, routing, loop, store search', {nodes:g.nodes.size,edges:g.edges.length,loopMeters:Math.round(loop.distance),stores:ranking.length});
