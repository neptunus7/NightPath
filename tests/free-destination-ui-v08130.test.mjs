import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../nowon/app.mjs',import.meta.url),'utf8');
const begin=app.indexOf('      const comparison=computeDestinationRoutes');
const end=app.indexOf('\n    }\n  }catch(e)',begin);
assert.ok(begin>0 && end>begin,'free destination event block exists');
const freeCode=app.slice(begin,end);
function tryChoice(samePath){
  const nodes={};let choiceButtons=[];const events=[];
  function make(id){return nodes[id]??={id,onclick:null,innerHTML:'',textContent:'',scrollTop:0,hidden:true};}
  const body=make('result-body');
  Object.defineProperty(body,'innerHTML',{get(){return this._inner||''},set(html){this._inner=html;
    choiceButtons=[...html.matchAll(/data-dest-choice="(\d+)"/g)].map(m=>({dataset:{destChoice:m[1]},onclick:null}));
    if(html.includes('id="confirm-destination-route"'))nodes['confirm-destination-route']={onclick:null};
    if(html.includes('id="cancel-destination-selection"'))nodes['cancel-destination-selection']={onclick:null};
  }});
  body.querySelectorAll=key=>key==='[data-dest-choice]'?choiceButtons:[];
  const route=(id,dist,coverage)=>({ids:[id],coords:[[37.65,127.07],[37.651,127.071]],distance:dist,minutes:dist/66.6666667,coverage,proximity:coverage*.6,repeat:0,kind:'path'});
  const a=route('short',300,.55),b=samePath?a:route('bright',373,.78);
  const comparison={shortest:a,bright:b,samePath,startSnapDistance:2,endSnapDistance:9};
  const sandbox={state:{routeChoices:[],destination:[37.651,127.071],start:[37.65,127.07],graph:{}},
    computeDestinationRoutes:()=>comparison,$:make,
    drawRoute:(...args)=>events.push(args),round:Math.round,coverageWarning:()=>'<p>coverage</p>',
    setResultCollapsed:()=>{},status:()=>{}};
  vm.runInNewContext(freeCode,sandbox);
  assert.equal(events.length,1,'initial preview draws selected route');
  assert.equal(choiceButtons.length,2,'both comparison options visible');
  assert.equal(events.at(-1)[0],samePath?a:b,'initially focus on light option unless identical');
  assert.equal(events.at(-1)[3].length,samePath?0:1,'same path has no fake gray alternative');
  choiceButtons[0].onclick();assert.equal(events.at(-1)[0],a,'click shortest preview');
  choiceButtons[1].onclick();assert.equal(events.at(-1)[0],b,'click bright preview');
  make('confirm-destination-route').onclick();
  assert.equal(events.at(-1)[0],b,'selected path stays drawn after confirmation');
  assert.equal(events.at(-1).length,1,'other alternatives and dashed comparisons removed on confirm');
  assert.ok(!body.innerHTML.includes('data-dest-choice'),'candidate list disappears after confirmation');
  assert.ok(body.innerHTML.includes('선택 취소'),'cancel available');
  make('cancel-destination-selection').onclick();
  assert.equal(choiceButtons.length,2,'cancel restores both comparison cards');
  assert.equal(events.at(-1)[0],b,'cancel restores previously previewed selection');
  assert.equal(events.at(-1)[3].length,samePath?0:1,'restores comparison line when paths differ');
  assert.equal(make('results').hidden,false);
}
tryChoice(false);tryChoice(true);
console.log('PASS free destination UI route comparison → preview → confirm → cancel, same-route case');
