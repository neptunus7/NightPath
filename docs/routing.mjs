// NIGHTPATH Nowon v0.8.1. Proxy only: modelled proximity to unverified light-related coordinates.
// NOT measured illumination, operational lights, accessibility certification, or personal safety.
export const WALK_M_PER_MIN = 66.6666667; // assumption: 4 km/h
const RAD = Math.PI / 180;
const EARTH = 6371000;
export function distanceMeters(a,b) {
  const p1=a[0]*RAD,p2=b[0]*RAD,dp=(b[0]-a[0])*RAD,dl=(b[1]-a[1])*RAD;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*EARTH*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
class Heap {
  constructor(){this.a=[];}
  push(x){const a=this.a;a.push(x);let n=a.length-1;while(n){let p=(n-1)>>1;if(a[p][0]<=x[0])break;a[n]=a[p];n=p;}a[n]=x;}
  pop(){const a=this.a;if(!a.length)return null;const top=a[0],v=a.pop();if(a.length){let p=0;while(true){let l=p*2+1,r=l+1;if(l>=a.length)break;let i=(r<a.length&&a[r][0]<a[l][0])?r:l;if(a[i][0]>=v[0])break;a[p]=a[i];p=i;}a[p]=v;}return top;}
  get length(){return this.a.length;}
}
const permitted=/^(footway|path|pedestrian|living_street|residential|service|tertiary|unclassified|steps|track|cycleway)$/;
function validWay(tags){
  if(!tags?.highway||!permitted.test(tags.highway))return false;
  if(tags.access==='private'||tags.access==='no'||tags.foot==='no'||tags.foot==='private'||tags.area==='yes'||tags.highway==='construction')return false;
  if(tags.highway==='cycleway' && tags.foot!=='yes' && tags.foot!=='designated')return false;
  return true;
}
// Conservative OSM-tag screen for the optional urban-nightwalk preference.
// OSM tags may be missing, incorrect or stale; this is NOT a real-world safety test.
const UNPAVED=/^(unpaved|dirt|earth|ground|mud|sand|grass|gravel|fine_gravel|pebblestone|woodchips|rock|stone|soil|grass_paver)$/;
const PAVED=/^(paved|asphalt|concrete|concrete:plates|concrete:lanes|paving_stones|sett|metal|wood)$/;
export function urbanWayAssessment(tags={}) {
  if(tags['nightpath:source']==='NGII_2025_road_centerline')return {allowed:true,reason:'unverified_ngii'};
  const hw=tags.highway||'',surface=(tags.surface||'').toLowerCase();
  if(tags.sac_scale||tags.trail_visibility==='bad'||tags.trail_visibility==='horrible')return {allowed:false,reason:'hiking_tag'};
  if(UNPAVED.test(surface)||/^(very_bad|horrible|very_horrible|impassable)$/.test(tags.smoothness||''))return {allowed:false,reason:'unpaved_or_rough'};
  if(tags.lit==='no')return {allowed:false,reason:'osm_unlit_tag'};
  if(hw==='steps')return {allowed:false,reason:'stairs'};
  // Trails without paving or explicit lit tags are not preferred by default.
  // A paved forest path can still be a poor nighttime choice: on-site checks remain needed.
  if((hw==='path'||hw==='track')&&!PAVED.test(surface)&&tags.lit!=='yes')return {allowed:false,reason:'unverified_trail'};
  if(tags.incline){
    const m=String(tags.incline).match(/^\s*([+-]?\d+(?:\.\d+)?)\s*(%|°)?\s*$/);
    if(m&&Math.abs(Number(m[1]))>((m[2]==='°')?7:12))return {allowed:false,reason:'steep_tag'};
  }
  return {allowed:true,reason:'no_known_warning'};
}
const xy=(lat,lon,center)=>[(lon-center[1])*111195*Math.cos(center[0]*RAD),(lat-center[0])*111195];
// 2022 public-data proximity, NOT a current safety certification.
// Includes only historic designated segments and CCTV / alarm / 112-location signs.
// This function is zero if records are absent. Old records never become current claims.
export function makeSupportIndex(data,center){
  if(!data||!Array.isArray(data.corridors)||!Array.isArray(data.facilities))return ()=>0;
  const samples=[];
  const point=(lon,lat)=>xy(lat,lon,center);
  function add(x,y,weight,radius){samples.push({x,y,weight,radius});}
  for(const f of data.facilities){
    if(f.geometry?.type!=='Point')continue;
    const [x,y]=point(...f.geometry.coordinates);const type=f.properties?.facility_type;
    const weight=type==='안심벨'?1:type==='CCTV'?.87:type==='112 위치 신고 안내'?.38:0;
    if(weight)add(x,y,weight,38);
  }
  for(const feature of data.corridors){
    const line=feature.geometry?.coordinates||[];
    if(feature.geometry?.type!=='LineString')continue;
    for(let i=1;i<line.length;i++){
      const [x1,y1]=point(...line[i-1]),[x2,y2]=point(...line[i]);
      const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/15));
      for(let j=0;j<=n;j++){const t=j/n;add(x1+(x2-x1)*t,y1+(y2-y1)*t,.48,25);}
    }
  }
  const buckets=new Map(),size=50;
  for(const p of samples){const key=Math.floor(p.x/size)+','+Math.floor(p.y/size);
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);
  }
  return (lat,lon)=>{
    const [x,y]=xy(lat,lon,center),i=Math.floor(x/size),j=Math.floor(y/size);let best=0;
    for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++)for(const p of buckets.get(`${i+di},${j+dj}`)||[]){
      const d=Math.hypot(p.x-x,p.y-y);if(d<p.radius)best=Math.max(best,p.weight*(1-d/p.radius));
    }
    return best;
  };
}
// Research-only distance-to-record heuristic, NOT a measured lux/illuminance radius.
// Late-night mode assumes more conservative scoring, NOT confirmed dimming in Nowon.
export const LIGHT_PROFILES = Object.freeze({
  normal: Object.freeze({ngii_street:15, ngii_security:8, legacy_safety:6, iot:6, osm:10, additional:8, simulation:8}),
  late: Object.freeze({ngii_street:11, ngii_security:6, legacy_safety:4, iot:4, osm:7, additional:6, simulation:6})
});
export function lightRadius(category, profile='normal') {
  return (LIGHT_PROFILES[profile]||LIGHT_PROFILES.normal)[category] ?? 6;
}
export function makeLightIndex(lights,center,profile='normal'){
  const buckets=new Map(),bucketSize=40;
  for(const l of lights){
    if(!Number.isFinite(l.lat)||!Number.isFinite(l.lon))continue;
    const [x,y]=xy(l.lat,l.lon,center),i=Math.floor(x/bucketSize),j=Math.floor(y/bucketSize);
    const key=`${i},${j}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push({x,y,category:l.category});
  }
  // A single overlapping lamp is not counted twice: maximum proximity influence per sample.
  return (lat,lon)=>{
    const [x,y]=xy(lat,lon,center),i=Math.floor(x/bucketSize),j=Math.floor(y/bucketSize);
    let highest=0;
    for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
      for(const p of buckets.get(`${i+di},${j+dj}`)||[]){
        const d=Math.hypot(x-p.x,y-p.y);
        const radius=lightRadius(p.category,profile);
        const weight=p.category==='ngii_street'?.92:p.category==='ngii_security'?.82:p.category==='iot'?.3:p.category==='legacy_safety'?.42:p.category==='osm'?.36:.45;
        if(d<radius)highest=Math.max(highest,(1-d/radius)*weight);
      }
    }
    return highest;
  };
}
export function buildGraph(elements,lights,center,opts={}){
  const nodes=new Map(),adj=new Map(),edges=[];
  let wayCount=0,skippedUrbanWays=0;
  const lightProximity=makeLightIndex(lights,center,opts.lightProfile||'normal');
  const supportProximity=makeSupportIndex(opts.supportData,center);
  function add(u,entry){if(!adj.has(u))adj.set(u,[]);adj.get(u).push(entry);}
  for(const item of elements){
    if(item.type!=='way'||!validWay(item.tags||{})||!item.nodes||!item.geometry||item.nodes.length!==item.geometry.length)continue;
    if(opts.urbanOnly&&!urbanWayAssessment(item.tags||{}).allowed){skippedUrbanWays++;continue;}
    wayCount++;
    for(let i=0;i<item.nodes.length;i++){
      const p=item.geometry[i];if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
      const id=String(item.nodes[i]);nodes.set(id,[p.lat,p.lon]);
      if(!i)continue;
      const q=item.geometry[i-1];if(!q||!Number.isFinite(q.lat)||!Number.isFinite(q.lon))continue;
      const u=String(item.nodes[i-1]), len=distanceMeters([q.lat,q.lon],[p.lat,p.lon]);
      if(!(len>=0.3&&len<=1000))continue;
      let avg=0,covered=0,supportAvg=0,supportCovered=0;const n=Math.min(14,Math.max(1,Math.ceil(len/15)));
      for(let k=0;k<n;k++){
        const t=(k+.5)/n;
        const score=lightProximity(q.lat+(p.lat-q.lat)*t,q.lon+(p.lon-q.lon)*t);
        avg+=score;if(score>=.06)covered++;
        const sv=supportProximity(q.lat+(p.lat-q.lat)*t,q.lon+(p.lon-q.lon)*t);
        supportAvg+=sv;if(sv>=.10)supportCovered++;
      }
      const edge={id:`${item.id}:${i}`,u,v:id,len,avg:avg/n,covered:covered/n,support:supportAvg/n,supportCovered:supportCovered/n,roadType:item.tags.highway,
        mapped:typeof opts.insideCoverage==='function' ? !!opts.insideCoverage((q.lat+p.lat)/2,(q.lon+p.lon)/2) : null};
      edges.push(edge);add(u,{to:id,edge});add(id,{to:u,edge});
    }
  }
  return {nodes,adj,edges,wayCount,skippedUrbanWays,urbanOnly:!!opts.urbanOnly,center};
}
export function nearestNode(graph,coord,maxMeters=220){
  let best=null,nearest=Infinity;
  for(const [id,p] of graph.nodes){const d=distanceMeters(coord,p);if(d<nearest){best=id;nearest=d;}}
  return nearest<=maxMeters?{id:best,distance:nearest}:null;
}
function edgeCost(edge,bias){
  const stepsFactor=edge.roadType==='steps'?1.5:1;
  return edge.len*stepsFactor*(1+bias*(1-edge.avg));
}
export function findRoute(graph,start,end,bias=0){
  if(!graph.nodes.has(start)||!graph.nodes.has(end))return null;
  const q=new Heap(),best=new Map([[start,0]]),previous=new Map();q.push([0,start]);
  while(q.length){
    const [c,u]=q.pop();if(c>best.get(u)+1e-8)continue;if(u===end)break;
    for(const {to,edge} of graph.adj.get(u)||[]){
      const next=c+edgeCost(edge,bias);
      if(next<(best.get(to)??Infinity)-1e-8){best.set(to,next);previous.set(to,{u,edge});q.push([next,to]);}
    }
  }
  if(!best.has(end))return null;
  let cur=end;const edges=[],ids=[end];
  while(cur!==start){const p=previous.get(cur);if(!p)return null;edges.push(p.edge);cur=p.u;ids.push(cur);}
  edges.reverse();ids.reverse();return routeFromEdges(graph,ids,edges);
}
function routeFromEdges(graph,ids,edges,kind="path"){
  const distance=edges.reduce((t,e)=>t+e.len,0);
  const prox=edges.reduce((t,e)=>t+e.len*e.avg,0);
  const cov=edges.reduce((t,e)=>t+e.len*e.covered,0);
  const supportCovered=edges.reduce((t,e)=>t+e.len*(e.supportCovered||0),0);
  const supportProx=edges.reduce((t,e)=>t+e.len*(e.support||0),0);
  const seen=new Set();let repeated=0;
  for(const edge of edges){const key=[edge.u,edge.v].sort().join(':');if(seen.has(key))repeated+=edge.len;seen.add(key);}
  const mappedLen=edges.reduce((t,e)=>t+(e.mapped===true?e.len:0),0);
  let turns=0,uturns=0;
  for(let i=1;i<ids.length-1;i++){
    const a=graph.nodes.get(ids[i-1]),b=graph.nodes.get(ids[i]),c=graph.nodes.get(ids[i+1]);
    if(!a||!b||!c)continue;
    const x=(a[1]-b[1])*Math.cos(b[0]*RAD),y=a[0]-b[0];
    const X=(c[1]-b[1])*Math.cos(b[0]*RAD),Y=c[0]-b[0];
    const d=Math.hypot(x,y)*Math.hypot(X,Y);
    if(!d)continue;
    const cos=Math.max(-1,Math.min(1,(x*X+y*Y)/d));
    const turn=Math.PI-Math.acos(cos); // 0 = straight, PI = U-turn
    if(turn>Math.PI*.55)turns++;
    if(turn>Math.PI*.85)uturns++;
  }
  const coords=ids.map(id=>graph.nodes.get(id));
  let twiceArea=0;
  if(kind==='loop'&&coords.length>=4){
    const lat0=graph.center[0],lon0=graph.center[1],cos=Math.cos(lat0*RAD);
    for(let i=0;i<coords.length-1;i++){
      const a=coords[i],b=coords[i+1];
      const ax=(a[1]-lon0)*111195*cos,ay=(a[0]-lat0)*111195;
      const bx=(b[1]-lon0)*111195*cos,by=(b[0]-lat0)*111195;
      twiceArea+=ax*by-bx*ay;
    }
  }
  // Pure geometry measure: circularity=1 for an ideal circle; 0 for a straight
  // out-and-back. Not a safety metric or evidence of accessible walkways.
  const compactness=distance>0?Math.min(1,2*Math.PI*Math.abs(twiceArea)/(distance*distance)):0;
  return {ids,edges,coords,distance,minutes:distance/WALK_M_PER_MIN,coverage:distance?cov/distance:0,
    proximity:distance?prox/distance:0,supportShare:distance?supportCovered/distance:0,
    supportProximity:distance?supportProx/distance:0,repeat:distance?repeated/distance:0,mappedShare:distance?mappedLen/distance:null,
    sharpTurns:turns,uTurns:uturns,compactness,kind};
}
export function brightestWithinDetour(graph,start,end,detour=0.35){
  const shortest=findRoute(graph,start,end,0);if(!shortest)return null;
  if(shortest.distance===0)return {route:shortest,shortest};
  let best=shortest,score=-Infinity;
  for(const bias of [0,.4,1.2,2.5,5,10]){
    const route=bias?findRoute(graph,start,end,bias):shortest;
    if(!route||route.distance>shortest.distance*(1+detour)+.01)continue;
    // Prefer nearby illuminated-length fraction; small penalty for extra walking.
    const s=.7*route.coverage+.3*route.proximity-.15*(route.distance/shortest.distance-1);
    if(s>score){score=s;best=route;}
  }
  return {route:best,shortest};
}
export function recommendStores(graph,start,stores,maxWalkM=1450){
  const result=[];
  for(const s of stores){
    const snapped=nearestNode(graph,[s.lat,s.lon],150);if(!snapped)continue;
    const pair=brightestWithinDetour(graph,start,snapped.id,.35);
    if(!pair||pair.shortest.distance>maxWalkM)continue;
    const r=pair.route;
    result.push({...s,route:r,shortest:pair.shortest,score:.75*r.coverage+.25*r.proximity-.12*(r.distance/Math.max(500,maxWalkM))});
  }
  result.sort((a,b)=>b.score-a.score||a.route.distance-b.route.distance);
  return result;
}
// A* over the real OSM walk graph; previously used vertices can be banned while
// stitching the loop. Thus real loops cannot re-enter their own earlier path.
function constrainedRoute(graph,start,end,opts={}){
  if(!graph.nodes.has(start)||!graph.nodes.has(end))return null;
  const {bannedNodes=new Set(),bannedEdges=new Set(),bias=.8,maxDistance=Infinity,maxVisits=25000}=opts;
  const target=graph.nodes.get(end),q=new Heap(),best=new Map([[start,0]]),previous=new Map();
  const h=id=>distanceMeters(graph.nodes.get(id),target);
  q.push([h(start),start,0]);let visits=0;
  while(q.length&&visits++<maxVisits){
    const [,u,g]=q.pop();
    if(g>(best.get(u)??Infinity)+1e-7)continue;
    if(u===end)break;
    for(const {to,edge} of graph.adj.get(u)||[]){
      if(bannedEdges.has(edge.id)|| (to!==end&&bannedNodes.has(to)))continue;
      const ng=g+edgeCost(edge,bias);
      if(ng>maxDistance*(1+bias)||ng>=(best.get(to)??Infinity)-1e-7)continue;
      best.set(to,ng);previous.set(to,{u,edge});q.push([ng+h(to),to,ng]);
    }
  }
  if(!best.has(end))return null;
  const ids=[end],edges=[];let cur=end;
  while(cur!==start){const p=previous.get(cur);if(!p)return null;edges.push(p.edge);cur=p.u;ids.push(cur);}
  ids.reverse();edges.reverse();return routeFromEdges(graph,ids,edges);
}
function simpleCycle(graph,start,a,b,maxDistance,bias=.65){
  const first=constrainedRoute(graph,start,a,{bias,maxDistance});
  if(!first||first.distance>maxDistance*.68)return null;
  const second=constrainedRoute(graph,a,b,{bias,bannedNodes:new Set(first.ids.slice(0,-1)),maxDistance:maxDistance-first.distance});
  if(!second)return null;
  const ban=new Set([...first.ids.slice(1),...second.ids.slice(1)]);
  ban.delete(b);ban.delete(start);
  const last=constrainedRoute(graph,b,start,{bias,bannedNodes:ban,maxDistance:maxDistance-first.distance-second.distance});
  if(!last)return null;
  const ids=[...first.ids,...second.ids.slice(1),...last.ids.slice(1)];
  const edges=[...first.edges,...second.edges,...last.edges];
  const route=routeFromEdges(graph,ids,edges,'loop');
  if(route.repeat>0||route.uTurns>0)return null;
  // A vertex-simple cycle (no figure-eight or self-crossing through nodes).
  if(new Set(ids.slice(0,-1)).size!==ids.length-1||ids[0]!==ids.at(-1))return null;
  return route;
}
// Extend already valid, vertex-simple cycles by replacing a short arc with an
// OSM-connected outer detour. Never join disconnected road fragments or re-use
// an interior vertex. This is a fallback for sparse longer-duration loops.
function detourExtensions(graph,base,target,mode,limit=35){
  const ids=base.ids,edges=base.edges;
  if(ids.length<8)return [];
  const cum=[0];for(const e of edges)cum.push(cum.at(-1)+e.len);
  const chosen=[];
  // Distance-based sampling avoids over-sampling OSM geometry nodes at bends.
  for(let d=100;d<base.distance-100;d+=Math.max(105,base.distance/12)){
    let i=cum.findIndex(x=>x>=d);i=Math.max(1,Math.min(ids.length-3,i));
    if(!chosen.includes(i))chosen.push(i);
  }
  const banEdges=new Set(edges.map(e=>e.id)),oldIds=new Set(ids.slice(0,-1));
  const generated=[];let count=0;
  for(let x=0;x<chosen.length;x++)for(let y=x+1;y<chosen.length;y++){
    if(count++>=limit)break;
    const i=chosen[x],j=chosen[y],arc=cum[j]-cum[i];
    if(arc<90||arc>base.distance*.66)continue;
    const remaining=base.distance-arc;
    if(remaining>=target*1.32)continue;
    const bannedNodes=new Set(oldIds);bannedNodes.delete(ids[i]);bannedNodes.delete(ids[j]);
    const alternate=constrainedRoute(graph,ids[i],ids[j],{
      bias:mode==='bright'?1.4:0.1,bannedNodes,bannedEdges:banEdges,
      maxDistance:Math.max(100,target*1.30-remaining),maxVisits:9500
    });
    if(!alternate||alternate.distance<arc+85)continue;
    const newIds=[...ids.slice(0,i+1),...alternate.ids.slice(1),...ids.slice(j+1)];
    const newEdges=[...edges.slice(0,i),...alternate.edges,...edges.slice(j)];
    if(newIds[0]!==newIds.at(-1)||new Set(newIds.slice(0,-1)).size!==newIds.length-1)continue;
    const route=routeFromEdges(graph,newIds,newEdges,'loop');
    if(route.repeat||route.uTurns||route.distance>target*1.31)continue;
    generated.push(route);
  }
  return generated;
}
export function rankLoopScore(route,mode,targetMinutes){
  const target=targetMinutes*WALK_M_PER_MIN;
  const error=Math.abs(route.distance-target)/Math.max(1,target);
  const shapePenalty=(route.sharpTurns/Math.max(1,route.distance/1000))*.014;
  const coveragePenalty=route.mappedShare===null?0:Math.max(0,.75-route.mappedShare)*.12;
  if(mode==='support')return .70*route.coverage+.28*route.proximity+
    2.90*(route.supportShare||0)+.28*(route.supportProximity||0)-2.5*error+.42*route.compactness-shapePenalty-coveragePenalty;
  if(mode==='bright')return 1.8*route.coverage+.65*route.proximity-(targetMinutes<=20?2.45:1.50)*error-shapePenalty-coveragePenalty;
  return .10*route.coverage+.04*route.proximity-4.0*error+1.25*route.compactness-shapePenalty-coveragePenalty;
}
function roadSignature(route){return route.edges.map(e=>e.id).sort().join('|');}
function addLongerLoopCandidates(graph,start,targetMinutes,opts,scoredRoutes){
  const target=targetMinutes*WALK_M_PER_MIN;
  const seedMinutes=targetMinutes>=55?[15,23,30,45]:targetMinutes>=42?[15,23,30]:[15,23];
  const seeds=[];
  for(const m of seedMinutes){
    if(m>=targetMinutes-5)continue;
    for(const route of recommendLoops(graph,start,m,{...opts,skipExtensions:!(m>=40&&targetMinutes>=55),seedMode:!(m>=40&&targetMinutes>=55),skipOutBack:true,maxRoutes:5})){
      if(route.kind==='loop')seeds.push(route);
    }
  }
  const mode=opts.mode==='support'?'support':opts.mode==='balanced'?'balanced':'bright';
  const seen=new Set(scoredRoutes.map(x=>roadSignature(x.route)));
  function offer(route){
    const sig=roadSignature(route);if(seen.has(sig))return false;seen.add(sig);
    const error=Math.abs(route.distance-target)/target;
    if(error<=.27){
      const shapePenalty=(route.sharpTurns/Math.max(1,route.distance/1000))*.014;
      const coveragePenalty=route.mappedShare===null?0:Math.max(0,.75-route.mappedShare)*.12;
      const score=rankLoopScore(route,mode,targetMinutes);
      scoredRoutes.push({route,score,extended:true});
    }
    return true;
  }
  seeds.sort((a,b)=>Math.abs(a.distance-target*.75)-Math.abs(b.distance-target*.75));
  let frontier=seeds.slice(0,12);
  for(const seed of frontier)offer(seed);
  for(let depth=0;depth<6&&frontier.length;depth++){
    const expanded=[];
    for(const base of frontier.slice(0,12)){
      for(const r of detourExtensions(graph,base,target,mode,60)){
        if(offer(r))expanded.push(r);
      }
    }
    // Move toward the target while keeping a few different geometries alive.
    expanded.sort((a,b)=>Math.abs(a.distance-target)-Math.abs(b.distance-target)
      || (mode==='bright'?b.coverage-a.coverage:0));
    const next=[],seenShapes=new Set();
    for(const x of expanded){
      const rough=x.ids.filter((_,i)=>i%Math.max(1,Math.ceil(x.ids.length/10))===0).slice(0,10).join('/');
      if(seenShapes.has(rough))continue;seenShapes.add(rough);next.push(x);
      if(next.length>=12)break;
    }
    frontier=next;
  }
}
// Undirected physical road overlap. Reversed traversal is the same route, not a new option.
function undirectedSegments(route){return new Set(route.edges.map(e=>[e.u,e.v].sort().join(':')));}
function sharedRoadFraction(a,b){
  const bSet=undirectedSegments(b);
  const common=a.edges.reduce((t,e)=>t+(bSet.has([e.u,e.v].sort().join(':'))?e.len:0),0);
  // Each edge can occur twice in an out-and-back route. Cap duplicates by
  // evaluating unique road length rather than treating a repeated road as new.
  const uniqueLength=(r)=>{const seen=new Set();let d=0;
    for(const e of r.edges){const k=[e.u,e.v].sort().join(':');if(!seen.has(k)){seen.add(k);d+=e.len;}}
    return d;};
  const sharedUnique=a.kind==='out_and_back'?common*.5:common;
  return sharedUnique/Math.max(1,Math.min(uniqueLength(a),uniqueLength(b)));
}
// Generate honest out-and-back alternatives only AFTER ranking genuine loops.
// The outward section follows existing graph edges, and the return exactly
// retraces those edges. The result has repeat~50%, and is labelled accordingly.
function backtrackAlternatives(graph,start,candidates,targetMinutes,mode,routeBias,opts={}){
  const target=targetMinutes*WALK_M_PER_MIN, results=[],seen=new Set();
  const biases=[routeBias,0];
  const ordered=[...candidates].sort((a,b)=>Math.abs(a.dist-target*.45)-Math.abs(b.dist-target*.45));
  for(const cand of ordered.slice(0,Math.min(58,opts.maxDestinations||48))){
    for(const bias of biases){
      const outward=constrainedRoute(graph,start,cand.id,{bias,maxDistance:target*.70,maxVisits:10000});
      if(!outward||outward.distance<target*.23||outward.distance>target*.68)continue;
      const reverseIds=[...outward.ids].reverse(),reverseEdges=[...outward.edges].reverse();
      const route=routeFromEdges(graph,[...outward.ids,...reverseIds.slice(1)],
        [...outward.edges,...reverseEdges],'out_and_back');
      const error=Math.abs(route.distance-target)/target;
      if(error>(opts.maxError??.26))continue;
      const sig=roadSignature(route);if(seen.has(sig))continue;seen.add(sig);
      // Do not rank a repeated route above a genuine loop, regardless of the score.
      // Within fallback options, prioritise requested time and then the selected
      // model's light/historical proximity, without calling it measured safety.
      const modelScore=rankLoopScore(route,mode,targetMinutes);
      const score=modelScore-1.2*error;
      results.push({route,score,error});
    }
  }
  results.sort((a,b)=>b.score-a.score||a.error-b.error);
  return results;
}
// Choose one representative with the highest relevant *recorded proximity*
// among time-eligible candidates, even if it retraces its own path. Genuine
// closed loops remain ahead of out-and-back options in the displayed order.
// Never claim this is the globally safest/brightest path: it is the highest
// observed percentage among the finite candidates actually searched.
export function chooseHighlightedAlternatives(loopEntries,backEntries,maxRoutes,mode,opts={}){
  const overlapLimit=opts.overlapLimit??.72;
  const metric=r=>mode==='support'?(r.supportShare||0):(r.coverage||0);
  const loops=[...loopEntries];
  const backs=[...backEntries];
  const all=[...loops,...backs];
  let featured=null;
  // The first valid genuine loop is always retained when one exists. It
  // anchors the user's loop-first expectation, even if a brighter backtrack
  // shares too much road with it to qualify as a distinct alternative.
  const chosen=loops.length?[loops[0]]:[];
  if(opts.highlight!==false && (mode==='bright'||mode==='support') && all.length){
    const compatible=all.filter(e=>chosen.includes(e)||
      chosen.every(x=>sharedRoadFraction(e.route,x.route)<=overlapLimit));
    const ranked=[...compatible].sort((a,b)=>metric(b.route)-metric(a.route)
      ||(a.route.kind==='loop'?0:1)-(b.route.kind==='loop'?0:1)
      ||b.score-a.score);
    featured=ranked.length&&metric(ranked[0].route)>0?ranked[0]:null;
    if(featured&&!chosen.includes(featured))chosen.push(featured);
  }
  for(const e of loops){
    if(chosen.length>=maxRoutes)break;
    if(chosen.includes(e)||chosen.some(x=>sharedRoadFraction(e.route,x.route)>overlapLimit))continue;
    chosen.push(e);
  }
  for(const e of backs){
    if(chosen.length>=maxRoutes)break;
    if(chosen.includes(e)||chosen.some(x=>sharedRoadFraction(e.route,x.route)>overlapLimit))continue;
    chosen.push(e);
  }
  // Sorting preserves the intuitive loop-first interface; the highlighted
  // backtrack stays in the last part rather than becoming default route #1.
  chosen.sort((a,b)=>(a.route.kind==='loop'?0:1)-(b.route.kind==='loop'?0:1)
    ||(a.route.kind==='loop'?b.score-a.score:b.score-a.score));
  return {chosen,featured};
}
export function recommendLoops(graph,start,targetMinutes=30,opts={}){
  // Route preference affects candidate cost + final ranking. Neither is a measured lux score.
  const mode=opts.mode==='support'?'support':opts.mode==='balanced'?'balanced':'bright';
  const routeBias=mode==='bright'?1.65:mode==='support'?.70:.45;
  const origin=graph.nodes.get(start);if(!origin)return null;
  const target=targetMinutes*WALK_M_PER_MIN;
  const radius=Math.min(890,Math.max(200,target*.22));
  const candidateMap=new Map();const count=targetMinutes<=20?28:20;
  for(const ratio of (targetMinutes<=20?[.43,.7,1]:[.65,1]))for(let k=0;k<count;k++){
    const angle=(k+.25)*2*Math.PI/count,r=radius*ratio;
    const anchor=[origin[0]+r*Math.sin(angle)/111195,origin[1]+r*Math.cos(angle)/(111195*Math.cos(origin[0]*RAD))];
    const near=nearestNode(graph,anchor,155);
    if(near&&near.id!==start){const direct=distanceMeters(origin,graph.nodes.get(near.id));
      if(direct>target*.075)candidateMap.set(near.id,{id:near.id,angle,dist:direct});}
  }
  const candidates=[...candidateMap.values()].slice(0,targetMinutes<=20?70:40),pairs=[];
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
    const a=candidates[i],b=candidates[j];
    const dangle=Math.acos(Math.cos(a.angle-b.angle));
    if(dangle<Math.PI*.42)continue; // avoid nearly collinear two-point excursions
    const chord=distanceMeters(graph.nodes.get(a.id),graph.nodes.get(b.id));
    const lower=a.dist+b.dist+chord;
    if(lower>target*1.22||lower<target*.30)continue;
    pairs.push({a:a.id,b:b.id,diff:Math.abs(lower*1.28-target)});
  }
  pairs.sort((a,b)=>a.diff-b.diff);
  const scoredRoutes=[];let scoredLoops=0;
  // Try true non-overlapping closed loops first. Even the selected candidate must
  // meet a reasonable requested duration; otherwise label a lower-quality fallback.
  for(const pair of pairs.slice(0,targetMinutes<=20?245:165)){
    for(const [a,b] of [[pair.a,pair.b],[pair.b,pair.a]]){
      const route=simpleCycle(graph,start,a,b,target*1.35,routeBias);
      if(!route)continue;
      const error=Math.abs(route.distance-target)/target;
      if(error>.34)continue;
      scoredLoops++;
      const shapePenalty=(route.sharpTurns/Math.max(1,route.distance/1000))*.014;
      const coveragePenalty=route.mappedShare===null?0:Math.max(0,.75-route.mappedShare)*.12;
      const score=rankLoopScore(route,mode,targetMinutes);
      scoredRoutes.push({route,score});
    }
  }
  // For longer walks, keep exploring genuine loop extensions even when the
  // first ring-pair pass found fewer than three eligible candidates.
  if(!opts.skipExtensions&&targetMinutes>=25&&scoredRoutes.length<12){
    addLongerLoopCandidates(graph,start,targetMinutes,opts,scoredRoutes);
  }
  // Bright search may miss a feasible long cycle because its A* cost emphasizes
  // nearby lamp coordinates. Pool the alternate-bias search only when truly
  // necessary; rank its verified OSM loops under the original bright objective.
  if(mode==='bright'&&!opts.skipExtensions&&!opts.skipCrossMode&&targetMinutes>=50
      &&!scoredRoutes.some(x=>Math.abs(x.route.distance-target)/target<=.09)){
    const alternatives=recommendLoops(graph,start,targetMinutes,{...opts,mode:'balanced',skipCrossMode:true,skipOutBack:true,maxRoutes:5});
    const known=new Set(scoredRoutes.map(x=>roadSignature(x.route)));
    for(const route of alternatives){
      if(route.kind!=='loop'||known.has(roadSignature(route)))continue;
      const error=Math.abs(route.distance-target)/target;
      const shapePenalty=(route.sharpTurns/Math.max(1,route.distance/1000))*.014;
      const coveragePenalty=route.mappedShare===null?0:Math.max(0,.75-route.mappedShare)*.12;
      const score=rankLoopScore(route,'bright',targetMinutes);
      scoredRoutes.push({route,score,crossBias:true});known.add(roadSignature(route));
    }
  }
  const maxRoutes=Math.max(1,Math.min(5,Number(opts.maxRoutes)||5));
  const overlapLimit=opts.seedMode?.95:.72;
  scoredRoutes.sort((a,b)=>b.score-a.score || Math.abs(a.route.distance-target)-Math.abs(b.route.distance-target));
  // Keep time eligibility separate from the light/historic-infrastructure
  // comparison. A very bright but badly timed route must not be advertised
  // as an appropriate walk just to win a percentage contest.
  const margin=targetMinutes<=20?.19:targetMinutes<=35?.20:.19;
  const closeRoutes=scoredRoutes.filter(x=>Math.abs(x.route.distance-target)/target<=margin);
  const loopPool=opts.seedMode?scoredRoutes:(closeRoutes.length?closeRoutes:scoredRoutes);
  // Unlike older versions, inspect out-and-back candidates EVEN IF five
  // loops were found. Otherwise the best light-coverage/historic-support
  // candidate could be silently excluded before the comparison starts.
  const fallbackPool=(!opts.seedMode&&!opts.skipOutBack)
    ?backtrackAlternatives(graph,start,candidates,targetMinutes,mode,routeBias):[];
  const choices=chooseHighlightedAlternatives(loopPool,fallbackPool,maxRoutes,mode,{overlapLimit,
    highlight:!opts.seedMode&&!opts.skipOutBack});
  const chosen=choices.chosen;
  // If no valid loop or normal backtrack exists, allow ONE honest fallback
  // with a larger time discrepancy and expose that discrepancy in the UI.
  if(!chosen.length&&!opts.seedMode&&!opts.skipOutBack){
    const rescue=backtrackAlternatives(graph,start,candidates,targetMinutes,mode,routeBias,{maxError:1});
    if(rescue.length)chosen.push(rescue[0]);
  }
  const loopCount=chosen.filter(x=>x.route.kind==='loop').length;
  return chosen.map(({route,score},i)=>{
    route.selection={mode,score,scoredLoops:scoredRoutes.length,anchorPairs:pairs.length,
      urbanOnly:!!graph.urbanOnly,rank:i+1,alternatives:chosen.length,
      loopCount,outBackCount:chosen.length-loopCount,
      highlighted:choices.featured?.route===route?(mode==='support'?'support':'bright'):null};
    return route;
  });
}
// Existing callers retain the single-best recommendation interface.
export function recommendLoop(graph,start,targetMinutes=30,opts={}){
  return recommendLoops(graph,start,targetMinutes,{...opts,maxRoutes:1})[0]||null;
}
export function osmElementsToStores(elements){
  const shops=[];
  for(const it of elements){
    if(it.tags?.shop!=='convenience')continue;
    let lat=it.lat,lon=it.lon;
    if((!Number.isFinite(lat)||!Number.isFinite(lon)) && it.center){lat=it.center.lat;lon=it.center.lon;}
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    shops.push({id:String(it.type)+String(it.id),lat,lon,name:it.tags.name||'이름 미기재 편의점',hours:it.tags.opening_hours||null,source:'OSM'});
  }
  return shops;
}
