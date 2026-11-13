import assert from 'node:assert/strict';
import {buildGraph,recommendLoops,recommendLoop,distanceMeters} from '../nowon/routing.mjs';
const center=[37.650555,127.0742],N=10,s=.00072,ways=[];let w=1000;
const p=(i,j)=>({lat:center[0]+(i-4.5)*s,lon:center[1]+(j-4.5)*s});
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const v=i*N+j+1;
  if(i<N-1)ways.push({id:w++,type:'way',nodes:[v,v+N],geometry:[p(i,j),p(i+1,j)],tags:{highway:'footway'}});
  if(j<N-1)ways.push({id:w++,type:'way',nodes:[v,v+1],geometry:[p(i,j),p(i,j+1)],tags:{highway:'residential'}});
}
const g=buildGraph(ways,[{...p(5,4),category:'ngii_street'}],center);
const start=String(5*N+5+1);
for(const mins of [5,23,30,60]){
  const routes=recommendLoops(g,start,mins,{maxRoutes:3,mode:'bright'});
  assert.ok(routes.length>=1&&routes.length<=3,`${mins} min returns 1-3 or fallback`);
  assert.ok(routes.every(r=>r.minutes>0));
  for(const r of routes){
    assert.equal(r.ids[0],r.ids.at(-1));
    if(r.kind==='loop')assert.equal(r.repeat,0);
  }
  for(let i=0;i<routes.length;i++)for(let j=0;j<i;j++){
    if(routes[i].kind!=='loop'||routes[j].kind!=='loop')continue;
    const a=routes[i],b=routes[j],setB=new Set(b.edges.map(e=>[e.u,e.v].sort().join(':')));
    const overlap=a.edges.reduce((t,e)=>t+(setB.has([e.u,e.v].sort().join(':'))?e.len:0),0)/Math.min(a.distance,b.distance);
    assert.ok(overlap<=.721,`alternatives ${i}/${j} must be truly distinct: ${overlap}`);
  }
  const first=recommendLoop(g,start,mins,{mode:'bright'});
  assert.ok(first&&first.distance===routes[0].distance);
  console.log(mins+'min: '+routes.length+' distinct options; best '+routes[0].minutes.toFixed(1)+'m, '+routes[0].kind);
}
assert.ok(distanceMeters(center,center)===0);
