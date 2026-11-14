import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../nowon/app.mjs', import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../nowon/index.html', import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../nowon/style.css', import.meta.url),'utf8');
assert.match(html,/BETA 0\.8\.13\.0/);
assert.match(app,/function previewStoreChoice\(index\)/);
assert.match(app,/function confirmStoreChoice\(\)/);
assert.match(app,/function confirmStoreChoice\(\)\{[\s\S]*?drawRoute\(c\.route,null,c\)/);
assert.match(app,/cancel-store-selection'\)\.onclick=\(\)=>previewStoreChoice\(selectedStoreIndex\)/);
assert.match(app,/confirm-store-route'\)\.onclick=confirmStoreChoice/);
assert.match(css,/\.store-choices \.store-card:focus-visible/);
assert.match(app,/function clearRecommendedRoute\(\)\{\s*routeLayer\.clearLayers\(\)/);
assert.match(app,/function confirmChoice\(\)\{[\s\S]*?drawRoute\(route\);/);
assert.match(app,/\$\('close-results'\)\.onclick=\(\)=>\{\$\('results'\)\.hidden=true;/);
const begin=app.indexOf('      const display=pickStoreRecommendations(candidates,8,2);');
const end=app.indexOf("\n    }else if(state.mode==='destination'){", begin);
assert.ok(begin>=0 && end>begin,'store interaction code found');
const storeCode=app.slice(begin,end);
const nodes={};
function make(id){return nodes[id]??=( {id,innerHTML:'',textContent:'',hidden:false,onclick:null});}
const body=make('result-body');
let buttons=[];
Object.defineProperty(body,'innerHTML',{get(){return this._html||''},set(value){this._html=value;
  buttons=[...value.matchAll(/data-store-choice="(\d+)"/g)].map(m=>({dataset:{storeChoice:m[1]},onclick:null}));
  if(value.includes('id="confirm-store-route"'))nodes['confirm-store-route']={id:'confirm-store-route',onclick:null};
  if(value.includes('id="cancel-store-selection"'))nodes['cancel-store-selection']={id:'cancel-store-selection',onclick:null};
}});
body.querySelectorAll=selector=>selector==='[data-store-choice]'?buttons:[];
const candidates=[
  {id:'store-a',name:'가까운 편의점 A',route:{coords:[[37.6505,127.074],[37.6506,127.075]],minutes:4.2,distance:280,coverage:.6},shortest:{distance:245},lat:37.6506,lon:127.075},
  {id:'store-b',name:'조명 많은 편의점 B',route:{coords:[[37.6505,127.074],[37.6510,127.074]],minutes:6.5,distance:432,coverage:.81},shortest:{distance:394},lat:37.6510,lon:127.074}
];
const events=[];
const sandbox={
  candidates,state:{routeChoices:[],shopHours:new Map()},
  pickStoreRecommendations:cs=>cs,
  $:make,drawRoute:(...args)=>events.push(args),
  coverageWarning:()=>'<p>범위 참고</p>',
  esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),round:Math.round,
  setResultCollapsed:()=>{},status:()=>{}
};
vm.runInNewContext(storeCode,sandbox);
assert.equal(buttons.length,2,'both shop choices rendered');
assert.equal(events.length,1);
assert.equal(events[0][0],candidates[0].route,'default preview draws first shop');
assert.equal(events[0][1],candidates[0].shortest,'preview may show shortest comparison');
buttons[1].onclick();
assert.equal(events.at(-1)[0],candidates[1].route,'user preview changes destination');
assert.equal(events.at(-1)[1],candidates[1].shortest);
assert.equal(buttons.length,2);
assert.ok(body.innerHTML.includes('경로 선택'));
make('confirm-store-route').onclick();
assert.equal(events.at(-1)[0],candidates[1].route,'confirmed choice remains visible');
assert.equal(events.at(-1)[1],null,'shortest dashed comparison hidden after confirmation');
assert.equal(events.at(-1)[2],candidates[1],'destination marker stays on map');
assert.ok(body.innerHTML.includes('편의점 경로')===false || body.innerHTML.includes('예상 도보 시간'));
assert.ok(body.innerHTML.includes('선택 취소'));
assert.ok(!body.innerHTML.includes('data-store-choice'),'other candidates disappear after confirmation');
make('cancel-store-selection').onclick();
assert.equal(buttons.length,2,'cancel restores destination alternatives');
assert.equal(events.at(-1)[0],candidates[1].route,'cancel restores previous preview');
assert.equal(events.at(-1)[1],candidates[1].shortest,'cancel restores comparison line');
assert.equal(nodes.results.hidden,false);
console.log('PASS v0.8.12.8 store preview → confirm with visible route → cancel restores list; walk route unchanged');
