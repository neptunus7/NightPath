// Synthetic topology only. These nodes are generated mathematically and DO NOT
// encode any real road or lighting facility location.
import {buildGraph,nearestNode,recommendLoops} from '../nowon/routing.mjs';
const BASE=[37.650555,127.0742],N=7,STEP=0.0008,ways=[];
const p=(i,j)=>({lat:BASE[0]+(i-3)*STEP,lon:BASE[1]+(j-3)*STEP});
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const id=i*N+j+1;
  if(i+1<N)ways.push({type:'way',id:10000+id*2,nodes:[id,id+N],geometry:[p(i,j),p(i+1,j)],tags:{highway:'footway'}});
  if(j+1<N)ways.push({type:'way',id:10000+id*2+1,nodes:[id,id+1],geometry:[p(i,j),p(i,j+1)],tags:{highway:'residential'}});
}
const lamps=[{...p(3,3),category:'ngii_street'},{...p(2,3),category:'ngii_security'}];
const graph=buildGraph(ways,lamps,BASE,{urbanOnly:true});
const start=nearestNode(graph,BASE);
if(!start)throw Error('No synthetic start node');
for(const mins of [15,30,45]){
  const routes=recommendLoops(graph,start.id,mins,{maxRoutes:5,mode:'bright'});
  console.log(`${mins} minute synthetic candidate(s):`,routes.map(r=>({kind:r.kind,approxMin:Number(r.minutes.toFixed(1)),coverage:Number((r.coverage||0).toFixed(3))})));
}
