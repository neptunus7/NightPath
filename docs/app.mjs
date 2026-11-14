import {buildGraph,nearestNode,brightestWithinDetour,recommendLoop,recommendLoops,recommendStores,osmElementsToStores,distanceMeters,lightRadius} from './routing.mjs';
import {createNightLightsLayer} from './light_canvas.mjs';
import {parseDailyRange,showShopLightAt} from './store_hours.mjs';
import {pickStoreRecommendations} from './store_recommendations.mjs';
import {computeDestinationRoutes} from './free_destination.mjs';
const $=id=>document.getElementById(id);
const CENTER=[37.650555110483,127.07420038053];
const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView(CENTER,15);
L.control.zoom({position:'bottomleft'}).addTo(map);
// v0.8.2.1: CARTO Dark Matter began requiring its own API key in 2026.
// Use OSM standard tiles for this local research preview; no NAVER/CARTO key needed.
// OSM tile usage policy: https://operations.osmfoundation.org/policies/tiles/
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom:20, maxNativeZoom:19,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
}).addTo(map);
// Dark mode changes ONLY the raster background, never the lamp/route overlays.
const tilePane=map.getPane('tilePane');
let darkBasemap=true;
function setBasemapTheme(dark){
  darkBasemap=dark;
  tilePane.classList.toggle('nightpath-dark-tiles', dark);
  const button=document.getElementById('toggle-map-theme');
  if(button){button.textContent=dark?'☀ 밝은 배경지도 보기':'☾ 어두운 배경지도 보기';button.setAttribute('aria-pressed',String(!dark));}
}
setBasemapTheme(true);
document.getElementById('toggle-map-theme')?.addEventListener('click',()=>setBasemapTheme(!darkBasemap));
const state={routeStrategy:'bright',urbanOnly:true,osmLoading:false,osmReady:false,rawLights:[],ngiiLights:[],ngiiCoverage:null,extraLights:[],osmLights:[],elements:null,shops:[],graph:null,roadSourceType:null,start:CENTER,mode:'loop',mins:30,pick:false,destinationPick:false,destination:null,lightProfile:'normal',routeChoices:[],activeRoute:null,safetyReference:null,shopHours:new Map()};
// Draw routes below the lamp glow. Keep the start/destination markers in Leaflet's marker pane.
const routePane=map.createPane('nightpathRoutePane');routePane.style.zIndex='330';routePane.style.pointerEvents='none';
const lampLayer=createNightLightsLayer(L,map),twinkleLayer=L.layerGroup().addTo(map),coverageLayer=L.layerGroup().addTo(map),supportLayer=L.layerGroup().addTo(map),routeLayer=L.layerGroup().addTo(map),startLayer=L.layerGroup().addTo(map),destinationLayer=L.layerGroup();
// Stable reference scope. The visual circle does NOT mean every segment has complete source coverage.
L.circle(CENTER,{radius:1000,color:'#41dec0',weight:1.5,dashArray:'7 7',opacity:.85,fillColor:'#41dec0',fillOpacity:.02,interactive:false}).addTo(map);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round=n=>Math.round(n);
function status(s){$('map-status').textContent=s;$('data-status').textContent=s;}
function showError(s){status(s);$('result-title').textContent='데이터 확인';$('result-body').innerHTML=`<p class="warn">${esc(s)}</p>`;setResultCollapsed(false);$('results').hidden=false;}
function currentLights(){return [...state.rawLights,...state.ngiiLights,...state.extraLights,...state.osmLights];}
function activeShopLights(){
  const time=$('shop-light-time')?.value||'22:00',radius=Number($('shop-light-radius')?.value)||15;
  const demo=$('demo-shops-247').checked;
  return state.shops.filter(store=>showShopLightAt(state.shopHours.get(store.id),time,demo))
    .map(s=>({id:`P${s.id}`,lat:s.lat,lon:s.lon,category:'shop_light',radius,name:s.name,source:demo?'편의점 · 24시간 운영 가정 (시연용)':'편의점 · 사용자가 입력한 영업시간 기반 시각화',confidence:'실제 영업·점등·조도 미확인 · 경로 점수 미반영'}));
}
function updateShopHourOptions(){
  const el=$('shop-hours-store'),selected=el.value;
  const list=state.shops.filter(s=>distanceMeters([s.lat,s.lon],CENTER)<=1000).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  el.replaceChildren();
  if(!list.length){const o=new Option('OSM 편의점이 없습니다','');el.add(o);return;}
  for(const s of list)el.add(new Option(s.name+' · '+s.id,s.id));
  if(list.some(s=>s.id===selected))el.value=selected;
  el.dispatchEvent(new Event('change'));
}
function updateShopSearchLinks(){
  const store=state.shops.find(s=>s.id===$('shop-hours-store').value);
  const q=encodeURIComponent(store?`${store.name} 서울 노원구 영업시간`:'서울 노원구 편의점 영업시간');
  $('shop-naver-search').href='https://map.naver.com/p/search/'+q;
  $('shop-kakao-search').href='https://map.kakao.com/?q='+q;
  const note=store?state.shopHours.get(store.id):null;
  $('shop-hours-type').value=note?.type||'unknown';
  $('shop-hours-range').value=note?.range||'19:00-03:00';
}
$('shop-hours-store').addEventListener('change',updateShopSearchLinks);
$('save-shop-hours').addEventListener('click',()=>{
  const id=$('shop-hours-store').value,type=$('shop-hours-type').value,range=$('shop-hours-range').value.trim();
  if(!id){$('shop-hours-status').textContent='편의점이 로딩된 후 선택해 주세요.';return;}
  if(type==='daily'&&!parseDailyRange(range)){$('shop-hours-status').textContent='시간은 HH:MM-HH:MM 형식이어야 하고 시작과 끝이 달라야 합니다.';return;}
  if(type==='unknown')state.shopHours.delete(id);else state.shopHours.set(id,{type,range});
  $('shop-hours-status').textContent='이 실행에서만 임시 반영했어. 지도 자료 자동 수집이나 영구 저장은 하지 않습니다. 실제 밝기·점수와 무관해요.';
  renderLights();
});
// Route-adjacent point display is ONLY a visual filter, not a claim about
// illumination reach or a recalculation of the scoring model.
function distanceToSelectedRoute(lat,lon,coords){
  if(!coords?.length)return Infinity;
  const meters=111195,cos=Math.cos(CENTER[0]*Math.PI/180);
  const x=(lon-CENTER[1])*meters*cos,y=(lat-CENTER[0])*meters;
  let best=Infinity;
  for(let i=1;i<coords.length;i++){
    const a=coords[i-1],b=coords[i];
    const ax=(a[1]-CENTER[1])*meters*cos,ay=(a[0]-CENTER[0])*meters;
    const bx=(b[1]-CENTER[1])*meters*cos,by=(b[0]-CENTER[0])*meters;
    const dx=bx-ax,dy=by-ay,denom=dx*dx+dy*dy;
    const t=denom?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/denom)):0;
    best=Math.min(best,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  return best;
}
// Experimental, non-data glow accents. Their activity is NEVER used for routing.
// Anchored to a random subset of recorded locations only for stable map alignment;
// do not interpret these pulses as real-world switching, brightness or a live feed.
function refreshDistantTwinkles(){
  twinkleLayer.clearLayers();
  if(!$('show-distant-twinkle')?.checked)return;
  const bounds=map.getBounds(),candidates=state.ngiiLights.filter(p=>bounds.contains([p.lat,p.lon]));
  const placed=[],count=Math.min(10,Math.max(3,Math.round(map.getSize().x/170)));
  if(!candidates.length)return;
  // Sample without sorting 9,193 records on each move; each rebuild varies the anchors.
  const attempts=Math.min(500,candidates.length*5);
  for(let i=0;i<attempts&&placed.length<count;i++){
    const p=candidates[Math.floor(Math.random()*candidates.length)];
    if(!p)continue;
    const xy=map.latLngToContainerPoint([p.lat,p.lon]);
    if(placed.some(q=>Math.hypot(q.x-xy.x,q.y-xy.y)<85))continue;
    placed.push(xy);
    const duration=(5+Math.random()*7).toFixed(2),delay=(-Math.random()*14).toFixed(2);
    const warm=Math.random()>.45;
    L.marker([p.lat,p.lon],{interactive:false,keyboard:false,icon:L.divIcon({
      className:'nightpath-distant-twinkle-marker',
      html:`<span class="nightpath-distant-twinkle ${warm?'warm':'cool'}" style="--pulse-duration:${duration}s;--delay:${delay}s" aria-hidden="true"></span>`,
      iconSize:[16,16],iconAnchor:[8,8]
    })}).addTo(twinkleLayer);
  }
}
map.on('zoomend moveend',refreshDistantTwinkles);
let twinkleReseedTimer=null;
function toggleExperimentalPulse(){
  refreshDistantTwinkles();
  if(twinkleReseedTimer!==null){clearInterval(twinkleReseedTimer);twinkleReseedTimer=null;}
  // Only schedule occasional re-seeding while the optional visual experiment is enabled.
  if($('show-distant-twinkle').checked)twinkleReseedTimer=setInterval(refreshDistantTwinkles,22000);
}
$('show-distant-twinkle').addEventListener('change',toggleExperimentalPulse);

function renderLights(){
  let n=0;
  const routeOnly=$('show-route-near-lights').checked&&state.activeRoute?.coords?.length>1;
  const maxOffset=Number($('route-light-distance').value)||30;
  const visible=[];
  for(const l of [...currentLights(),...($('show-shop-light').checked?activeShopLights():[])]){
    if(routeOnly&&distanceToSelectedRoute(l.lat,l.lon,state.activeRoute.coords)>maxOffset)continue;
    const key=l.category==='shop_light'?'show-shop-light':l.category==='ngii_street'?'show-ngii-street':l.category==='ngii_security'?'show-ngii-security':l.category==='legacy_safety'?'show-safety':l.category==='osm'?'show-osm':'show-iot';
    if(!$(key).checked)continue;
    visible.push({...l,radius:l.category==='shop_light'?l.radius:lightRadius(l.category,state.lightProfile)});n++;
  }
  lampLayer.update(visible,{halo:true,glow:$('show-night-glow').checked,intensity:Number($('glow-intensity').value),haloIntensity:Number($('halo-intensity').value)});
  $('shop-light-count').textContent=activeShopLights().length+'곳';
  $('glow-intensity-value').textContent=$('glow-intensity').value+'%';
  $('halo-intensity-value').textContent=$('halo-intensity').value+'%';
  $('ngii-street-count').textContent=state.ngiiLights.filter(x=>x.category==='ngii_street').length.toLocaleString();
  $('ngii-security-count').textContent=state.ngiiLights.filter(x=>x.category==='ngii_security').length.toLocaleString();
  $('iot-count').textContent=state.rawLights.filter(x=>x.category==='iot').length+state.extraLights.length;
  $('safety-count').textContent=state.rawLights.filter(x=>x.category==='legacy_safety').length;
  $('osm-count').textContent=state.osmLights.length;
  $('lamp-total').textContent=currentLights().length.toLocaleString();
  refreshDistantTwinkles();
  const quick=$('quick-route-lights');if(quick){const on=$('show-route-near-lights').checked;quick.classList.toggle('active',on);quick.setAttribute('aria-pressed',String(on));}
  const display=$('route-light-filter-status');if(display)display.textContent=routeOnly?`선택한 코스 ±${maxOffset}m에 위치한 조명 좌표 ${n.toLocaleString()}개 표시 · 점수는 변경되지 않음`:$('show-route-near-lights').checked?'추천 코스를 선택하면 주변 조명만 표시합니다.':'레이어 표시만 변경하며 점수 계산에는 전체 자료를 사용합니다.';
  coverageLayer.clearLayers();
  if(state.ngiiCoverage && $('show-coverage').checked)L.geoJSON({type:'Feature',properties:{},geometry:state.ngiiCoverage},{style:{color:'#e8f2ff',weight:1.2,opacity:.48,fillColor:'#dddfff',fillOpacity:.012,dashArray:'5 6'},interactive:false}).addTo(coverageLayer);
}
// Native L.GridLayer tile transforms now keep light markers attached during live pan and zoom.
// Re-rendering on every map move is unnecessary and can cause noticeable lag.
map.on('click',e=>{
  if(state.pick||map.getZoom()<14)return;
  const l=lampLayer.findNearest(e.latlng,8);if(!l)return;
  L.popup({closeButton:true,maxWidth:290}).setLatLng([l.lat,l.lon]).setContent(`<strong>${esc(l.facilityType||l.source)}</strong><br><small>${esc(l.source)}</small><br>위도 ${l.lat.toFixed(6)}, 경도 ${l.lon.toFixed(6)}<br><span>${esc(l.confidence||'입력 자료, 현황 미검증')}</span>`).openOn(map);
});

function renderSupportReference(){
  supportLayer.clearLayers();
  const ref=state.safetyReference;if(!ref)return;
  if(!$('show-support-reference').checked)return;
  for(const f of ref.corridors||[]){
    if(f.geometry?.type!=='LineString')continue;
    const coords=f.geometry.coordinates.map(p=>[p[1],p[0]]);
    L.polyline(coords,{color:'#eac577',weight:3,dashArray:'5 8',opacity:.75})
      .bindPopup(`<b>가상 안심구간 (시연)</b><br>${esc(f.properties?.세부위치||'구간 정보')}<br>가상 자료 · 실제 시설 아님`).addTo(supportLayer);
  }
  for(const f of ref.facilities||[]){
    if(f.geometry?.type!=='Point')continue;
    const [lon,lat]=f.geometry.coordinates,t=f.properties?.facility_type||'기록 시설';
    const color=t==='안심벨'?'#ffbd67':t==='CCTV'?'#70cafa':'#c1abfa';
    L.circleMarker([lat,lon],{radius:3.2,color,weight:1.2,fillColor:'#102535',fillOpacity:.95})
      .bindPopup(`<b>${esc(t)} · 가상 기록</b><br>가상 자료 · 실제 시설 아님`).addTo(supportLayer);
  }
}
async function loadSupportReference(){
  try{
    const res=await fetch('./data/safety_synthetic.json');if(!res.ok)throw Error('HTTP '+res.status);
    const x=await res.json();if(x.reference_year!=='synthetic'||!Array.isArray(x.facilities))throw Error('형식 불일치');
    state.safetyReference=x;
    $('support-reference-status').textContent=`가상 안심구간 ${x.corridors.length}구간 · CCTV/안심벨/112 안내 ${x.facilities.length}기록 (현재 현황 미검증)`;
    renderSupportReference();
  }catch(e){$('support-reference-status').textContent='안심 참고자료를 읽지 못했습니다 · 경로 분석에는 반영하지 않음';}
}
function showStart(){
  startLayer.clearLayers();
  const markerIcon=L.divIcon({className:'nightpath-start-marker-container',html:'<span class="nightpath-start-marker" aria-hidden="true"><span class="start-moon">☾</span><span class="start-spark">✦</span></span>',iconSize:[38,45],iconAnchor:[19,42],popupAnchor:[0,-38]});
  L.marker(state.start,{icon:markerIcon,zIndexOffset:750}).addTo(startLayer).bindPopup('☾ 경로 출발 위치 · 출발 위치 설정에서 변경할 수 있어요.');
  $('start-status').textContent=`${state.start[0].toFixed(4)}, ${state.start[1].toFixed(4)} · 지도 클릭으로 변경`;
}
function showDestination(){
  destinationLayer.clearLayers();
  if(!state.destination){$('destination-status').textContent='아직 지정한 도착지가 없습니다.';return;}
  const [lat,lon]=state.destination;
  $('destination-status').textContent=`선택한 도착지: ${lat.toFixed(5)}, ${lon.toFixed(5)} · 지도에서 다시 지정 가능`;
  const icon=L.divIcon({className:'nightpath-free-destination-wrap',html:'<span class="nightpath-free-destination" aria-hidden="true">⌖</span>',iconSize:[32,38],iconAnchor:[16,35]});
  L.marker([lat,lon],{icon,zIndexOffset:720}).addTo(destinationLayer).bindPopup('⌖ 내가 지정한 도착지 · 실제 도로망 마지막 노드와 거리가 있을 수 있습니다.');
}
function selectTab(mode){
  state.mode=mode;state.pick=false;state.destinationPick=false;
  for(const kind of ['loop','shop','destination'])$('tab-'+kind).classList.toggle('active',mode===kind);
  $('loop-panel').hidden=mode!=='loop';$('shop-panel').hidden=mode!=='shop';$('destination-panel').hidden=mode!=='destination';
  $('recommend').textContent=mode==='loop'?'✦ 산책 코스 추천받기':mode==='shop'?'⌁ 주변 편의점 경로 찾기':'⌖ 도착지 경로 비교하기';
  if(mode==='destination'){if(!map.hasLayer(destinationLayer))destinationLayer.addTo(map);}else if(map.hasLayer(destinationLayer))map.removeLayer(destinationLayer);
}
$('tab-loop').onclick=()=>selectTab('loop');$('tab-shop').onclick=()=>selectTab('shop');$('tab-destination').onclick=()=>selectTab('destination');
function clearRecommendedRoute(){
  routeLayer.clearLayers();state.activeRoute=null;state.routeChoices=[];
  $('results').hidden=true;setResultCollapsed(false);renderLights();
}
function setMinutes(value){
  const n=Math.max(5,Math.min(60,Math.round(Number(value)||30)));
  if(n!==state.mins)clearRecommendedRoute();
  state.mins=n;$('duration').value=n;$('duration-number').value=n;
  $('duration-current').textContent=`${n}분`;
  for(const b of document.querySelectorAll('#times button'))b.classList.toggle('active',Number(b.dataset.min)===n);
}
for(const b of document.querySelectorAll('#times button'))b.onclick=()=>setMinutes(b.dataset.min);
$('duration').oninput=e=>setMinutes(e.target.value);
$('duration-number').onchange=e=>setMinutes(e.target.value);
// Support mouse-wheel adjustment only while pointing at the slider; prevent
// page scroll on that control, not globally.
$('duration').addEventListener('wheel',e=>{e.preventDefault();setMinutes(state.mins+(e.deltaY<0?1:-1));},{passive:false});
setMinutes(30);
$('pick-start').onclick=()=>{state.pick=true;state.destinationPick=false;$('map-start-panel').open=false;status('☾ 지도에서 출발 위치를 클릭하세요.');};
$('reset-start').onclick=()=>{state.pick=false;state.start=CENTER;showStart();clearRecommendedRoute();map.panTo(CENTER);};
$('go-start').onclick=()=>{map.flyTo(state.start,Math.max(16,map.getZoom()),{duration:.65});$('map-start-panel').open=false;};
$('pick-destination').onclick=()=>{selectTab('destination');state.destinationPick=true;status('⌖ 지도에서 원하는 도착지를 한 번 클릭하세요.');};
$('reset-destination').onclick=()=>{state.destinationPick=false;state.destination=null;showDestination();clearRecommendedRoute();status('도착지 지정이 초기화됐어요.');};
map.on('click',e=>{
  if(state.pick){state.start=[e.latlng.lat,e.latlng.lng];state.pick=false;showStart();clearRecommendedRoute();status('출발점 변경 완료. 경로를 다시 추천할 수 있어요.');return;}
  if(state.destinationPick){
    const destination=[e.latlng.lat,e.latlng.lng];
    if(distanceMeters(CENTER,destination)>1200){showError('연구 기준점에서 1.2km 밖입니다. 현재 확보한 보행망을 기준으로 중심 근처에서 도착지를 지정해 주세요.');return;}
    state.destination=destination;state.destinationPick=false;showDestination();clearRecommendedRoute();status('도착지 설정 완료. 「도착지 경로 비교하기」를 눌러 주세요.');
  }
});
$('clear-route').onclick=clearRecommendedRoute;
function setResultCollapsed(collapsed){
  $('results').classList.toggle('is-collapsed',collapsed);
  $('result-toggle').textContent=collapsed?'펼치기':'접기';
  $('result-toggle').setAttribute('aria-expanded',String(!collapsed));
}
$('result-toggle').onclick=()=>setResultCollapsed(!$('results').classList.contains('is-collapsed'));
$('close-results').onclick=()=>{$('results').hidden=true;};
$('route-strategy').onchange=()=>{state.routeStrategy=$('route-strategy').value;clearRecommendedRoute();
  if(state.routeStrategy==='support'){$('show-support-reference').checked=true;renderSupportReference();}
  status('경로 추천 방식 변경 · 다시 추천해 주세요.');};
$('urban-only').onchange=()=>{state.urbanOnly=$('urban-only').checked;rebuildGraph();clearRecommendedRoute();status(state.urbanOnly?'도심 산책 우선 적용 · OSM 태그 기준 산길 후보 제한':'도심 필터 해제 · 산지/계단 포함 가능 · 실제 보행 전 현장 확인 필요');};
$('light-profile').onchange=()=>{state.lightProfile=$('light-profile').value;renderLights();rebuildGraph();clearRecommendedRoute();status('모델 반경 변경 완료 · 이전 추천 경로 삭제됨. 다시 추천해 주세요.');};
for(const id of ['show-shop-light','demo-shops-247','shop-light-time','shop-light-radius','show-ngii-street','show-ngii-security','show-coverage','show-iot','show-safety','show-osm','show-night-glow','show-route-near-lights','route-light-distance'])$(id).onchange=renderLights;
$('glow-intensity').addEventListener('input',renderLights);
$('halo-intensity').addEventListener('input',renderLights);
$('show-support-reference').addEventListener('change',renderSupportReference);
$('quick-route-lights').onclick=()=>{const input=$('show-route-near-lights');input.checked=!input.checked;renderLights();};
function drawRoute(route,shortest=null,marker=null,alternatives=[]){
  routeLayer.clearLayers();
  state.activeRoute=route;
  // Navigator-style muted non-selected alternatives; selected path stays teal.
  for(const r of alternatives){if(r===route||r.coords.length<2)continue;
    L.polyline(r.coords,{pane:'nightpathRoutePane',color:'#90a6c0',weight:3.5,opacity:.5,dashArray:'7 8',interactive:false}).addTo(routeLayer);
  }
  if(shortest&&shortest.coords.length>1)L.polyline(shortest.coords,{pane:'nightpathRoutePane',color:'#bdcedb',weight:4,opacity:.5,dashArray:'7 10'}).addTo(routeLayer);
  // Three translucent strokes create a very subtle across-width gradient.
  // This route pane is BELOW the illumination pane (330 < 350), so light
  // visibly falls over the route, rather than looking painted under its line.
  L.polyline(route.coords,{pane:'nightpathRoutePane',color:'#43debd',weight:8.5,opacity:.12,lineCap:'round',className:'nightpath-route-aura',interactive:false}).addTo(routeLayer);
  L.polyline(route.coords,{pane:'nightpathRoutePane',color:'#083d3d',weight:4.5,opacity:.76,lineCap:'round',interactive:false}).addTo(routeLayer);
  L.polyline(route.coords,{pane:'nightpathRoutePane',color:'#56e9ca',weight:2.5,opacity:.96,lineCap:'round'}).addTo(routeLayer);
  if(marker){const shopIcon=L.divIcon({className:'nightpath-shop-destination-wrap',html:'<span class="nightpath-shop-destination" aria-hidden="true">⌂</span>',iconSize:[30,34],iconAnchor:[15,30]});L.marker([marker.lat,marker.lon],{icon:shopIcon}).addTo(routeLayer).bindPopup(esc(marker.name));}
  if(route.coords.length>1)map.fitBounds(L.latLngBounds(route.coords).pad(.2),{maxZoom:17,padding:[24,24]});
  renderLights();
}
function pointInRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function insideCoverage(lat,lon){
  const g=state.ngiiCoverage;
  if(!g)return false;
  const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  return polygons.some(rings=>pointInRing(lon,lat,rings[0])&&!rings.slice(1).some(hole=>pointInRing(lon,lat,hole)));
}
function routeCoverageShare(route){
  let total=0,covered=0;
  for(let i=1;i<route.coords.length;i++){
    const a=route.coords[i-1],b=route.coords[i];const d=distanceMeters(a,b);total+=d;
    if(insideCoverage((a[0]+b[0])/2,(a[1]+b[1])/2))covered+=d;
  }
  return total?covered/total:0;
}
function coverageWarning(route){
  if(!state.ngiiCoverage)return '<p class="result-desc">공개 데모의 조명은 모두 가상 좌표입니다. 실제 시설과 무관합니다.</p>';
  const f=routeCoverageShare(route);
  return `<p class="result-desc">가상 시연 범위 안 경로 비율 약 ${(f*100).toFixed(0)}% (실제 조명 확보율이나 밝기 점수가 아님)</p>`+
    (f<.9?'<p class="warn">시연 범위 밖을 지난다고 실제로 어둡거나 조명이 없다는 뜻은 아닙니다.</p>':'');
}
function statsHtml(route){
  const roadWarning=state.roadSourceType==='ngii'?'<div class="warn"><b>임시 도로중심선 경로:</b> 2025 국토지리정보원 지도에서 변환한 자동차 도로 중심선입니다. 보도·횡단보도·출입 제한·실제 보행 가능 여부는 확인되지 않았습니다. 실제 도보 길안내나 야간 안전 판단에 사용하지 마세요.</div>':'';
  return `<div class="result-spotlight"><span class="result-eyebrow">예상 산책 시간</span><div class="result-number">${route.minutes.toFixed(1)}<small>분</small></div><span class="result-unit">시속 4km 가정 · 실제 소요시간과 다를 수 있음</span></div><div class="metric-grid"><div class="metric-card"><span>이동 거리</span><strong>${round(route.distance).toLocaleString()}<small>m</small></strong></div><div class="metric-card"><span>조명시설 근접</span><strong>${round(route.coverage*100)}<small>%</small></strong></div><div class="metric-card"><span>반복 구간</span><strong>${round(route.repeat*100)}<small>%</small></strong></div><div class="metric-card"><span>경로 형태</span><strong class="metric-word">${route.kind==='loop'?'순환':'왕복 대안'}</strong></div></div><p class="result-note">조명시설 근접도는 추정값이며 실제 밝기나 안전도를 측정한 값이 아닙니다. 가상 안심 인프라 근접 구간 ${(100*(route.supportShare||0)).toFixed(0)}% (가상 시연 시설; 안전 점수 아님).</p>${coverageWarning(route)}${roadWarning}<div class="warn">OSM을 불러와도 보행 허용·보도 연결·통행제한은 현장 검증 전까지 보장되지 않습니다.</div><div class="warn">시설별 근접 반경(가로등 15/11m, 보안등 8/6m)은 모델링 가정입니다. 근접 구간 비율은 밝기나 보행 안전도 측정값이 아닙니다.</div>`;
}
function determineStart(){
  if(!state.graph||!state.graph.edges.length)throw new Error(state.osmLoading?'OSM 도로망을 내려받는 중입니다. 준비 완료 후 추천할 수 있습니다.':'도로망이 준비되지 않았습니다. 데모 OSM 데이터를 다시 불러와 주세요.');
  const snapped=nearestNode(state.graph,state.start,220);
  if(!snapped)throw new Error('선택한 위치에서 220m 이내에 현재 필터 기준으로 연결 가능한 길이 없습니다. 지도에서 다른 출발점을 선택하거나 도심 산책 설정을 확인해 주세요.');
  return snapped.id;
}
async function recommend(){
  try{
    $('map-start-panel').open=false;
    const start=determineStart();$('recommend').disabled=true;status('경로 계산 중…');
    await new Promise(r=>setTimeout(r,35));
    if(state.mode==='loop'){
      const routes=recommendLoops(state.graph,start,state.mins,{mode:state.routeStrategy,maxRoutes:5});
      if(!routes.length)throw new Error('현재 보행망과 도심 필터 설정으로 산책 코스를 생성하지 못했습니다. 출발점·시간을 바꾸거나 OSM 자료를 점검해 주세요. 산지 후보를 자동으로 허용하지는 않습니다.');
      state.routeChoices=routes;
      let selectedIndex=0;
      function selectChoice(index){
        selectedIndex=index;
        const route=routes[index];
        drawRoute(route,null,null,routes);
        $('result-title').textContent=(state.routeStrategy==='bright'?'💪 최광루트':state.routeStrategy==='support'?'🛡 안심 인프라 참고형':'⚖ 균형형')+' · '+(route.kind==='loop'?`${state.mins}분 순환 산책`:`${state.mins}분 왕복 대안`);
        const delta=Math.abs(route.minutes-state.mins),meta=route.selection||{};
        const optionList=routes.map((r,i)=>{
          const featured=r.selection?.highlighted;
          const badge=featured==='bright'?'💡 비교 가능한 코스 중 조명 근접률 최상':featured==='support'?'🛡 비교 가능한 코스 중 가상 안심 기록 근접률 최상':'';
          return `<button type="button" class="route-choice ${i===index?'chosen':''} ${featured?'featured':''}" data-choice="${i}" aria-pressed="${i===index}"><strong>${i===0?'추천 ':''}코스 ${i+1} · ${r.kind==='loop'?'☾ 순환 산책':'↔ 왕복 산책'} ${i===index?'✓':''}</strong>${badge?`<span class="route-highlight">${badge}</span>`:''}<small>${r.minutes.toFixed(1)}분 · ${round(r.distance).toLocaleString()}m · 목표 오차 ${Math.abs(r.minutes-state.mins).toFixed(1)}분</small><small>조명 근접 ${round(r.coverage*100)}% · 가상 안심 인프라 근접 ${round((r.supportShare||0)*100)}%</small></button>`;
        }).join('');
        const loops=routes.filter(r=>r.kind==='loop').length,backs=routes.length-loops;
        const listIntro=`<p class="result-desc">최대 5개 코스 · 순환형 ${loops}개 우선, 왕복형 ${backs}개 포함. ${state.routeStrategy==='bright'?'조명 근접률':state.routeStrategy==='support'?'과거 안심 인프라 근접률':'선택 평가 기준'} 최상 후보가 왕복형이어도 조건에 맞으면 함께 비교해요. 최상이란 시간·경로 중복 조건을 통과한 비교 후보 내 근접률이며 실제 밝기·안전도는 아니에요. 미리 볼 코스를 누른 다음 선택을 확정할 수 있어요.</p><div class="route-choices">${optionList}</div><div class="route-actions"><button type="button" class="route-confirm" id="confirm-route">✓ 코스 ${index+1} 선택</button></div>`;
        const modelExplain=`<p class="result-desc">추천 근거 · ${state.routeStrategy==='bright'?'조명시설 근접도를 더 중시':state.routeStrategy==='support'?'가상 안심구간·안심 관련 시설 기록과 조명 근접도를 함께 고려':'시간 오차와 자연스러운 순환 모양을 더 중시'} · 순환 형태지수 ${(route.compactness*100).toFixed(0)}/100 (기하학적 모양, 안전성 무관) · 평가한 순환 후보 ${meta.scoredLoops??'—'}건 (${routes.length}개 경로 제시)</p>`;
        const urbanExplain=state.roadSourceType==='ngii'?'<p class="warn">도심 필터는 NGII 임시 중심선의 산지·계단 여부를 판별하지 못합니다.</p>':`<p class="result-desc">${state.urbanOnly?'도심 우선: OSM 태그상 산길·비포장·계단 등 일부 길 제외':'도심 필터 해제: 산길 포함 가능'} · OSM 태그가 누락된 산길은 판별 불가</p>`;
        $('result-body').innerHTML=listIntro+statsHtml(route)+modelExplain+urbanExplain+`<p class="result-desc">${route.kind==='loop'?'같은 경유 노드를 반복하지 않고 출발점으로 돌아오는 순환 코스입니다.':'보행망에서 목표 길이의 순환 코스를 만들지 못해 왕복 경로를 표시했습니다.'} 목표 ${state.mins}분 대비 오차 ${delta.toFixed(1)}분. · ${state.lightProfile==='late'?'심야 보수적 모델':'일반 야간 모델'}</p>${route.kind!=='loop'?'<p class="warn">순환 코스와 함께 비교하는 왕복형입니다. 같은 길을 되돌아오므로 반복 구간이 많습니다.</p>':''}${delta>Math.max(2.5,state.mins*.1)?'<p class="warn">목표 시간 대비 차이가 큽니다. 반복 없는 경로를 우선해 시간을 정확히 맞추지 못했습니다. 다른 출발점이나 시간을 선택해 주세요.</p>':''}${routes.length===1?'<p class="result-desc">조건을 만족하는 서로 다른 코스를 추가로 찾지 못해 1개만 표시했습니다.</p>':''}`;
        $('result-body').scrollTop=0;
        for(const button of $('result-body').querySelectorAll('.route-choice'))button.onclick=()=>selectChoice(Number(button.dataset.choice));
        $('confirm-route').onclick=confirmChoice;
        setResultCollapsed(false);
        $('results').hidden=false;
      }
      function confirmChoice(){
        const route=routes[selectedIndex];
        // Keep ONLY the confirmed route visible on the map. Alternative routes
        // disappear here; only the explicit "경로 지우기" action removes it.
        // drawRoute updates state.activeRoute and preserves near-route light filtering.
        drawRoute(route);
        $('result-title').textContent=`✓ 코스 ${selectedIndex+1} 선택 완료`;
        $('result-body').innerHTML=`<div class="confirmed-route"><strong>☾ ${route.kind==='loop'?'순환형':'왕복형'} · 코스 ${selectedIndex+1}</strong><p>선택한 코스만 지도에 표시 중이에요. 다른 후보는 숨겼고, 취소하면 비교 목록이 복원됩니다. 지도에서 경로를 없애려면 ‘경로 지우기’를 눌러 주세요.</p><button type="button" id="cancel-route-selection" class="route-cancel">↶ 선택 취소 · 코스 다시 보기</button></div>`+statsHtml(route);
        $('result-body').scrollTop=0;
        $('cancel-route-selection').onclick=()=>selectChoice(selectedIndex);
        setResultCollapsed(false);
        $('results').hidden=false;
      }
      selectChoice(0);
      status((state.routeStrategy==='bright'?'최광루트':state.routeStrategy==='support'?'안심 인프라 참고형':'균형형')+' 계산 완료 · 실제 밝기/안전성 실측 아님');
    }else if(state.mode==='shop'){
      if(state.roadSourceType==='ngii')throw new Error('오프라인 수치지도에는 편의점 위치 정보가 포함되지 않습니다. OSM 보행망·편의점 온라인 새로고침에 성공한 후 이용하세요. 가상의 편의점을 생성하지는 않습니다.');
      const candidates=recommendStores(state.graph,start,state.shops);
      if(!candidates.length)throw new Error('이 범위에서 OSM 편의점을 찾지 못했거나, 보행망과 연결되지 않았습니다. 자료 부족일 수 있습니다.');
      const display=pickStoreRecommendations(candidates,8,2);
      state.routeChoices=display.map(s=>s.route);
      let selectedStoreIndex=0;
      function storeStatsHtml(c){
        const extra=Math.max(0,c.route.distance-c.shortest.distance);
        return `<div class="result-spotlight"><span class="result-eyebrow">편의점까지 예상 도보 시간</span><div class="result-number">${c.route.minutes.toFixed(1)}<small>분</small></div><span class="result-unit">시속 4km 가정 · 실제 소요시간과 다를 수 있음</span></div>`+
          `<div class="metric-grid"><div class="metric-card"><span>이동 거리</span><strong>${round(c.route.distance).toLocaleString()}<small>m</small></strong></div><div class="metric-card"><span>조명시설 근접</span><strong>${round(c.route.coverage*100)}<small>%</small></strong></div><div class="metric-card"><span>최단 보행거리</span><strong>${round(c.shortest.distance).toLocaleString()}<small>m</small></strong></div><div class="metric-card"><span>최단 대비 우회</span><strong>${round(extra).toLocaleString()}<small>m</small></strong></div></div>`+
          `<p class="result-desc">${state.shopHours.has(c.id)?'사용자가 입력한 임시 영업시간 참고 · 현재 영업 여부 재확인 필요':'실제 영업 여부 확인 필요'}. 편의점 24시간 운영은 광원 표시용 시연 가정이며, 점등·안전·실측 조도 정보가 아닙니다.</p>`+
          coverageWarning(c.route)+`<p class="warn">OSM 보행망의 실제 통행 가능성과 매장 출입구 위치는 검증되지 않았습니다. 조명 근접도는 실제 밝기·안전성 보장이 아닙니다.</p>`;
      }
      function previewStoreChoice(index){
        selectedStoreIndex=index;
        const c=display[index];
        drawRoute(c.route,c.shortest,c);
        $('result-title').textContent='편의점 · 조명시설 근접 경로';
        const list=display.map((store,i)=>`<button type="button" class="store-card ${index===i?'chosen':''}" data-store-choice="${i}" aria-pressed="${index===i}"><strong>${i+1}. ${esc(store.name)}${i<Math.min(2,display.length)?' · 가까운 곳':''} ${index===i?'✓':''}</strong><small>예상 ${store.route.minutes.toFixed(1)}분 · 근접 ${round(store.route.coverage*100)}% · 최단 ${round(store.shortest.distance)}m</small><small>${state.shopHours.has(store.id)?'사용자가 임시 입력한 영업시간 · 현재 여부 재확인':'영업 여부 확인 필요'}</small></button>`).join('');
        $('result-body').innerHTML='<p class="result-desc">가까운 편의점 2곳 우선 포함 + 조명 근접도 상위 후보를 비교합니다. 보행망 기준 최대 1,450m · 최단 대비 35% 우회 허용. 목적지를 눌러 미리 본 뒤 선택을 확정할 수 있어요.</p>'+
          `<div class="store-choices">${list}</div><div class="route-actions"><button type="button" class="route-confirm" id="confirm-store-route">✓ ${esc(c.name)} 경로 선택</button></div>`+
          coverageWarning(c.route)+'<p class="warn">24시간 영업과 편의점 푸른빛은 시연용 가정입니다. 실제 영업 여부와 주변 조도를 확인해 주세요. OSM에 없거나 도로망에 연결되지 않은 점포는 목록에서 빠질 수 있습니다.</p>';
        $('result-body').scrollTop=0;
        for(const button of $('result-body').querySelectorAll('[data-store-choice]'))button.onclick=()=>previewStoreChoice(Number(button.dataset.storeChoice));
        $('confirm-store-route').onclick=confirmStoreChoice;
        setResultCollapsed(false);$('results').hidden=false;
      }
      function confirmStoreChoice(){
        const c=display[selectedStoreIndex];
        // Confirmation must retain the chosen route and destination marker,
        // but must remove the shortest-path dashed comparison from the map.
        // Only the explicit "경로 지우기" action clears the confirmed line.
        drawRoute(c.route,null,c);
        $('result-title').textContent='✓ 편의점 경로 선택 완료';
        $('result-body').innerHTML=`<div class="confirmed-route"><strong>⌂ ${esc(c.name)} · 경로 확정</strong><p>이 편의점까지의 추천 경로만 지도에 유지됩니다. 다른 후보는 숨겨졌어요. 선택을 취소하면 비교 목록을 다시 볼 수 있어요.</p><button type="button" id="cancel-store-selection" class="route-cancel">↶ 선택 취소 · 편의점 다시 비교</button></div>`+storeStatsHtml(c);
        $('result-body').scrollTop=0;
        $('cancel-store-selection').onclick=()=>previewStoreChoice(selectedStoreIndex);
        setResultCollapsed(false);$('results').hidden=false;
      }
      previewStoreChoice(0);
      status(`편의점 ${candidates.length}곳 후보 경로 비교 완료`);
    }else if(state.mode==='destination'){
      if(!state.destination)throw new Error('먼저 「지도에서 도착지 지정」을 눌러 목적지를 선택해 주세요.');
      if(state.roadSourceType==='ngii')throw new Error('현재 도로망은 보행 검증이 없는 NGII 자동차 도로중심선입니다. 자유 목적지 경로는 OSM 보행망이 준비된 뒤 이용해 주세요.');
      const comparison=computeDestinationRoutes(state.graph,state.start,state.destination);
      state.routeChoices=[comparison.shortest,comparison.bright];
      let selectedIndex=comparison.samePath?0:1;
      function destinationStats(route){
        const detour=Math.max(0,route.distance-comparison.shortest.distance);
        return `<div class="result-spotlight"><span class="result-eyebrow">도착지까지 예상 도보 시간</span><div class="result-number">${route.minutes.toFixed(1)}<small>분</small></div><span class="result-unit">시속 4km 가정 · 보행 실측값 아님</span></div>`+
          `<div class="metric-grid"><div class="metric-card"><span>이동 거리</span><strong>${round(route.distance).toLocaleString()}<small>m</small></strong></div><div class="metric-card"><span>조명시설 근접</span><strong>${round(route.coverage*100)}<small>%</small></strong></div><div class="metric-card"><span>거리 우선 경로 대비</span><strong>+${round(detour).toLocaleString()}<small>m</small></strong></div><div class="metric-card"><span>모델상 조명 근접 영향</span><strong>${round(route.proximity*100)}<small>%</small></strong></div></div>`+
          `<p class="result-desc">도착점에서 도로망 노드까지 약 ${round(comparison.endSnapDistance)}m, 출발점에서 도로망 노드까지 약 ${round(comparison.startSnapDistance)}m 이격. 이 간격은 제시된 경로 거리와 소요시간에 포함되지 않으며 실제 보행 연결이 아닙니다.</p>`+
          coverageWarning(route)+'<p class="warn">조명시설 근접률은 거리 가정에 따른 모델값이며 실제 lux·점등 상태나 개인 안전을 뜻하지 않습니다. OSM 태그와 보행 가능 여부는 현장 검증 전까지 보장되지 않습니다.</p>';
      }
      function previewDestination(index){
        selectedIndex=index;
        const route=index===0?comparison.shortest:comparison.bright;
        const other=index===0?comparison.bright:comparison.shortest;
        drawRoute(route,null,null,comparison.samePath?[]:[other]);
        $('result-title').textContent='⌖ 자유 도착지 · 경로 비교';
        const optionList=[{title:'거리 우선 (최단)',route:comparison.shortest},{title:'조명 근접도 우선',route:comparison.bright}].map((item,i)=>
          `<button type="button" class="route-choice ${selectedIndex===i?'chosen':''}" data-dest-choice="${i}" aria-pressed="${selectedIndex===i}"><strong>${i===0?'➤':'✦'} ${item.title} ${selectedIndex===i?'✓':''}</strong><small>${item.route.minutes.toFixed(1)}분 · ${round(item.route.distance)}m · 조명 근접 ${round(item.route.coverage*100)}%</small></button>`).join('');
        $('result-body').innerHTML=`<p class="result-desc">같은 출발점·목적지를 OSM 보행 후보망으로 비교합니다. 조명 우선 경로는 거리 우선 대비 최대 35% 우회하는 가정이며, 여러 후보 중 평가한 결과입니다. ${comparison.samePath?'두 계산이 동일한 경로를 선택했으므로 실제로는 하나의 경로만 표시됩니다.':'선택된 코스는 민트색, 다른 대안은 회색 점선으로 표시됩니다.'}</p>`+
          `<div class="route-choices destination-choices">${optionList}</div><div class="route-actions"><button type="button" class="route-confirm" id="confirm-destination-route">✓ ${selectedIndex===0?'거리 우선':'조명 우선'} 경로 선택</button></div>`+destinationStats(route);
        $('result-body').scrollTop=0;
        for(const button of $('result-body').querySelectorAll('[data-dest-choice]'))button.onclick=()=>previewDestination(Number(button.dataset.destChoice));
        $('confirm-destination-route').onclick=confirmDestination;
        setResultCollapsed(false);$('results').hidden=false;
      }
      function confirmDestination(){
        const route=selectedIndex===0?comparison.shortest:comparison.bright;
        drawRoute(route); // Only selected path; destinationLayer retains destination marker.
        $('result-title').textContent='✓ 자유 도착지 경로 선택 완료';
        $('result-body').innerHTML=`<div class="confirmed-route"><strong>⌖ ${selectedIndex===0?'거리 우선':'조명 근접도 우선'} · 경로 확정</strong><p>선택한 경로만 지도에 유지됩니다. 다른 경로를 다시 비교하려면 선택을 취소하고, 경로를 없애려면 「경로 지우기」를 누르세요.</p><button id="cancel-destination-selection" type="button" class="route-cancel">↶ 선택 취소 · 경로 다시 비교</button></div>`+destinationStats(route);
        $('result-body').scrollTop=0;
        $('cancel-destination-selection').onclick=()=>previewDestination(selectedIndex);
        setResultCollapsed(false);$('results').hidden=false;
      }
      previewDestination(selectedIndex);
      status(`자유 도착지 경로 비교 완료 · ${comparison.samePath?'두 방식이 같은 길을 선택했어요':'두 경로를 비교할 수 있어요'} · 실제 조도 아님`);
    }
  }catch(e){showError(e.message||String(e));}finally{$('recommend').disabled=false;}
}
$('recommend').onclick=recommend;
// GitHub Pages demo: preserve the original routing/UI implementation but load only
// the bundled ODbL walking network. Never fetch NGII/IoT datasets or query Overpass.
function validOsmPayload(obj){
  return obj&&Array.isArray(obj.elements)&&obj.elements.some(e=>e.type==='way'&&e.nodes?.length>=2&&e.geometry?.length===e.nodes.length);
}
async function fetchJson(url){
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const data=await res.json();
  if(!validOsmPayload(data))throw new Error('도로 데이터 형식 오류');
  return data.elements;
}
async function getOsmElements(){
  return {elements:await fetchJson('./data/osm_nowon.json'),source:'ODbL 공개 OSM 보행망 (정적 데이터)'};
}
function readOsmLights(elements){
  return elements.filter(el=>el.type==='node'&&el.tags?.highway==='street_lamp'&&Number.isFinite(el.lat)&&Number.isFinite(el.lon)).map(x=>({lat:x.lat,lon:x.lon,id:`O${x.id}`,category:'osm',source:'OpenStreetMap 가로등 기록 (ODbL)',confidence:'실제 설치·점등 상태 확인되지 않음'}));
}
function rebuildGraph(){
  if(!state.elements)return;
  state.graph=buildGraph(state.elements,currentLights(),CENTER,{lightProfile:state.lightProfile,insideCoverage,urbanOnly:state.urbanOnly,supportData:state.safetyReference});
  $('road-total').textContent=state.graph.edges.length.toLocaleString();
  const x=$('excluded-road-count');if(x)x.textContent=state.roadSourceType==='ngii'?'NGII 임시 도로중심선은 산길 태그가 없어 필터 적용 불가':`도심 우선 기준 제외 OSM 길 ${state.graph.skippedUrbanWays.toLocaleString()}개`;
  renderLights();
}
async function applyOsmElements(elements,source){
  if(!validOsmPayload({elements}))throw new Error('입력된 OSM 파일에는 보행로 geometry 데이터가 없어.');
  const original={elements:state.elements,shops:state.shops,lights:state.osmLights,graph:state.graph,roadSourceType:state.roadSourceType};
  try{
    clearRecommendedRoute();state.elements=elements;state.shops=osmElementsToStores(elements);state.osmLights=readOsmLights(elements);
    updateShopHourOptions();
    state.roadSourceType=elements.some(el=>el.tags?.['nightpath:source']==='NGII_2025_road_centerline')?'ngii':'osm';
    status('실제 OSM 도로망과 가상 광원 근접 모델 계산 중…');await new Promise(r=>setTimeout(r,20));
    rebuildGraph();
    if(!state.graph||state.graph.edges.length===0)throw new Error('연결 가능한 OSM 도로 구간이 없습니다.');
    state.osmReady=true;
    $('recommend').disabled=false;
    status(state.roadSourceType==='ngii'?`오프라인 도로중심선 ${state.graph.edges.length.toLocaleString()}구간 · 보행 가능 여부 미검증 · 실제 길안내 금지`:`OSM 보행 후보망 ${state.graph.edges.length.toLocaleString()}구간 / 편의점 ${state.shops.length}곳 · ${source} · 조명과 안심은 가상 시연`);
  }catch(err){
    Object.assign(state,{elements:original.elements,shops:original.shops,osmLights:original.lights,graph:original.graph,roadSourceType:original.roadSourceType});
    throw err;
  }
}
async function loadOSM(force=false){
  if(state.osmLoading)return;
  state.osmLoading=true;$('load-osm').disabled=true;
  $('recommend').disabled=true;
  status(force?'데모 도로망 다시 읽는 중… 실패해도 기존 경로 유지':'데모에 포함된 OSM 보행망을 불러오는 중…');
  try{
    const {elements,source}=await getOsmElements(force);
    await applyOsmElements(elements,source);
  }catch(err){
    if(state.graph&&state.graph.edges.length){
      $('recommend').disabled=false;state.osmReady=true;
      status('새 도로망 다운로드 실패. 기존에 준비된 도로망으로 계속 사용할 수 있습니다.');
    }else{state.osmReady=false;showError(String(err.message||err));}
  }finally{state.osmLoading=false;$('load-osm').disabled=false;}
}
$('load-osm').onclick=()=>loadOSM(true);
function xmlOsmToElements(raw){
  if(raw.length>60_000_000)throw new Error('OSM XML 60MB 이하 파일을 선택해 주세요.');
  const doc=new DOMParser().parseFromString(raw,'application/xml');
  if(doc.querySelector('parsererror')||doc.documentElement.tagName!=='osm')throw new Error('올바른 OSM XML이 아닙니다.');
  const nodeMap=new Map(),elements=[];
  for(const n of doc.querySelectorAll('node[id][lat][lon]')){
    const lat=Number(n.getAttribute('lat')),lon=Number(n.getAttribute('lon'));
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    nodeMap.set(n.getAttribute('id'),{lat,lon});
    const tags=Object.fromEntries([...n.children].filter(x=>x.tagName==='tag').map(x=>[x.getAttribute('k'),x.getAttribute('v')]));
    if(tags.shop==='convenience'||tags.highway==='street_lamp')elements.push({type:'node',id:Number(n.getAttribute('id')),lat,lon,tags});
  }
  const admitted=new Set(['footway','path','pedestrian','living_street','residential','service','tertiary','unclassified','steps','track','cycleway']);
  for(const w of doc.querySelectorAll('way[id]')){
    const tags=Object.fromEntries([...w.children].filter(x=>x.tagName==='tag').map(x=>[x.getAttribute('k'),x.getAttribute('v')]));
    if(!admitted.has(tags.highway)&&tags.shop!=='convenience')continue;
    const nodes=[],geometry=[];
    for(const n of [...w.children].filter(x=>x.tagName==='nd')){
      const ref=n.getAttribute('ref'),p=nodeMap.get(ref);
      if(p){nodes.push(Number(ref));geometry.push(p);}
    }
    if(nodes.length<2)continue;
    const item={type:'way',id:Number(w.getAttribute('id')),nodes,geometry,tags};
    if(tags.shop==='convenience')item.center={lat:geometry.reduce((a,x)=>a+x.lat,0)/geometry.length,lon:geometry.reduce((a,x)=>a+x.lon,0)/geometry.length};
    elements.push(item);
  }
  if(!validOsmPayload({elements}))throw new Error('좌표가 연결된 보행 후보 도로가 없는 OSM 파일입니다.');
  return elements;
}
async function persistManualOsm(elements){
  try{
    return false; // 공개 Pages에는 쓰기 API가 없으며 사용자 업로드를 전송하지 않습니다.
  }catch{return false;}
}
$('osm-import').onchange=async ev=>{
  try{
    const file=ev.target.files?.[0];if(!file)return;
    $('osm-import-status').textContent='OSM/JSON 검사 중…';
    const text=await file.text();
    const elements=/\.(osm|xml)$/i.test(file.name)?xmlOsmToElements(text):(()=>{const obj=JSON.parse(text);return Array.isArray(obj)?obj:obj.elements;})();
    await applyOsmElements(elements,'사용자가 선택한 로컬 파일 (비공개·임시)');
    const saved=false; // Pages 데모에서는 업로드한 데이터를 서버에 전송하거나 저장하지 않음
    $('osm-import-status').textContent=`도로망 ${state.graph.edges.length.toLocaleString()}구간 · ${state.roadSourceType==='ngii'?'보행 미검증 도로중심선':saved?'로컬 디스크 캐시 저장됨':'브라우저에만 임시 저장됨'} · 실제 보행 가능 여부 현장 확인 필요`;
    $('results').hidden=true;
  }catch(err){$('osm-import-status').textContent=`불러오기 실패: ${String(err.message||err)}`;}
};
function importFeatures(obj){
  const arr=Array.isArray(obj)?obj:obj?.type==='FeatureCollection'?obj.features:obj?.lights;
  if(!Array.isArray(arr))throw new Error('JSON은 [{lat, lon}] 또는 GeoJSON FeatureCollection 구조여야 합니다.');
  return arr.map((f,i)=>{
    const p=f.properties||f;const xy=f.geometry?.type==='Point'?f.geometry.coordinates:null;
    const lat=Number(p.lat??p.latitude??p.위도??(xy?xy[1]:NaN));
    const lon=Number(p.lon??p.lng??p.longitude??p.경도??(xy?xy[0]:NaN));
    return {id:`X${i}`,lat,lon,category:'additional',source: p.source||'직접 불러온 좌표(검증 전)',confidence:'사용자 업로드: 현황 미검증'};
  }).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&distanceMeters(CENTER,[x.lat,x.lon])<=1700);
}
function parseCsv(s){
  const lines=s.replace(/^\uFEFF/,'').trim().split(/\r?\n/);const header=lines.shift().split(',').map(x=>x.trim().replace(/^"|"$/g,''));
  // Basic CSV simple field parser; for embedded commas in quoted fields prefer GeoJSON import.
  return lines.map((line,i)=>{
    const cols=line.split(',').map(x=>x.trim().replace(/^"|"$/g,''));const o={};header.forEach((h,j)=>o[h]=cols[j]);return o;
  });
}
$('upload').onchange=async e=>{
  try{
    const file=e.target.files?.[0];if(!file)return;
    const bytes=await file.arrayBuffer();let text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('euc-kr').decode(bytes);}
    const data=file.name.toLowerCase().endsWith('.csv')?parseCsv(text):JSON.parse(text);
    const features=importFeatures(data);if(!features.length)throw new Error('연구 범위에서 유효한 위도·경도 좌표가 없습니다.');
    state.extraLights.push(...features);$('upload-status').textContent=`${features.length}개 추가 · 기존 자료 유지`;
    status(`추가 좌표 ${features.length}개 반영 · 경로 모델 재계산`);await new Promise(r=>setTimeout(r,15));
    rebuildGraph();clearRecommendedRoute();renderLights();
  }catch(err){$('upload-status').textContent=err.message||String(err);}
};
async function init(){
  showStart();
  toggleExperimentalPulse();
  try{const data=await (await fetch('./data/extra_lights_synthetic.json')).json();state.rawLights=data.lights;
    const ngii=await (await fetch('./data/lights_synthetic.json')).json();state.ngiiLights=ngii.lights||[];state.ngiiCoverage=ngii.coverage||null;await loadSupportReference();renderLights();status('웹 데모: 실제 OSM 도로·편의점 + 가상 조명·안심시설 로딩 중…');await loadOSM(false);}
  catch(e){showError('기본 좌표를 읽지 못했습니다. python -m http.server 8000 실행 후 접속하세요. '+String(e.message||e));}
}
init();
