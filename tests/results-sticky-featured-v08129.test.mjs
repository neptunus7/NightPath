import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseHighlightedAlternatives,buildGraph,nearestNode,recommendLoops} from '../nowon/routing.mjs';
const root=new URL('../',import.meta.url);
const css=readFileSync(new URL('nowon/style.css',root),'utf8');
const html=readFileSync(new URL('nowon/index.html',root),'utf8');
const app=readFileSync(new URL('nowon/app.mjs',root),'utf8');
assert.match(css,/\.results\s*\{display:flex;flex-direction:column;padding:0;overflow:hidden/);
assert.match(css,/\.results #result-body\{[^}]*overflow-y:auto/);
assert.match(css,/\.results\.is-collapsed \.results-top\{[^}]*min-height:40px/);
assert.match(html,/id="result-toggle"/);assert.match(html,/id="close-results"/);
assert.match(app,/drawRoute\(route\);/);assert.match(app,/drawRoute\(c\.route,null,c\);/);
const mk=(id,kind,coverage,supportShare,score)=>({route:{kind,coverage,supportShare,edges:[{u:`${id}u`,v:`${id}v`,len:500}]},score});
const loops=[0,1,2,3,4].map(i=>mk('loop'+i,'loop',.55+i*.03,.05+i*.01,10-i));
const back=mk('back','out_and_back',.96,.29,3);
for(const mode of ['bright','support']){
 const {chosen,featured}=chooseHighlightedAlternatives(loops,[back],5,mode);
 assert.equal(chosen.length,5);assert.equal(chosen.filter(x=>x.route.kind==='loop').length,4);
 assert.equal(chosen.at(-1),back);assert.equal(featured,back);
 assert.ok(chosen.slice(0,4).every(x=>x.route.kind==='loop'));
}
// Do not sacrifice the sole loop just to display a largely duplicated
// brighter out-and-back route. A distinct runner-up can be shown instead.
const lonely=mk('one','loop',.30,.2,10);
const copied={route:{kind:'out_and_back',coverage:1,supportShare:.95,edges:[...lonely.route.edges,...lonely.route.edges]},score:12};
const separate=mk('separate','out_and_back',.80,.6,8);
const integrity=chooseHighlightedAlternatives([lonely],[copied,separate],5,'bright');
assert.equal(integrity.chosen[0],lonely);assert.equal(integrity.featured,separate);
assert.ok(!integrity.chosen.includes(copied));
const zeros=chooseHighlightedAlternatives([mk('no','loop',.8,0,5)],[mk('other','out_and_back',.9,0,4)],5,'support');
assert.equal(zeros.featured,null,'no unsupported safe/verified infrastructure claim');
// Public repository: test selection contracts against entirely synthetic candidates.
// The private/full-app real-world OSM integration test was intentionally omitted.
for(const mode of ['bright','support']){
  const loops=[0,1,2,3,4].map(i=>mk('synthetic-loop-'+i,'loop',.3+i*.05,.02+i*.03,10-i));
  const back=mk('synthetic-back','out_and_back',.99,.45,2);
  const {chosen,featured}=chooseHighlightedAlternatives(loops,[back],5,mode);
  assert.equal(chosen.length,5);
  assert.equal(chosen.filter(c=>c.route.kind==='loop').length,4);
  assert.equal(chosen.at(-1).route.kind,'out_and_back');
  assert.equal(featured,back);
}
console.log('PASS v0.8.12.9 UI layout + featured selection (synthetic candidates only)');
