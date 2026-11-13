import assert from 'node:assert/strict';
import {urbanWayAssessment,buildGraph,recommendLoop} from '../nowon/routing.mjs';
const C=[37.65055,127.0742];
for(const tags of [
 {highway:'path'}, {highway:'track'}, {highway:'steps'},
 {highway:'footway',surface:'dirt'}, {highway:'footway',sac_scale:'hiking'},
 {highway:'residential',lit:'no'}, {highway:'footway',incline:'18%'}
])assert.equal(urbanWayAssessment(tags).allowed,false,JSON.stringify(tags));
for(const tags of [
 {highway:'footway'}, {highway:'residential'},
 {highway:'path',surface:'asphalt'}, {highway:'path',lit:'yes'},
 {highway:'unclassified','nightpath:source':'NGII_2025_road_centerline'}
])assert.equal(urbanWayAssessment(tags).allowed,true,JSON.stringify(tags));
const coords=[[C[0],C[1]],[C[0]+.002,C[1]],[C[0]+.002,C[1]+.002],[C[0],C[1]+.002]];
const elems=coords.map((point,i)=>({type:'way',id:i+1,nodes:[i+1,(i+1)%4+1],geometry:[{lat:point[0],lon:point[1]},{lat:coords[(i+1)%4][0],lon:coords[(i+1)%4][1]}],tags:i===0?{highway:'path',surface:'dirt'}:{highway:'residential'}}));
const all=buildGraph(elems,[],C,{urbanOnly:false}),urban=buildGraph(elems,[],C,{urbanOnly:true});
assert.equal(all.edges.length,4);assert.equal(urban.edges.length,3);assert.equal(urban.skippedUrbanWays,1);
assert.ok(recommendLoop(all,'1',15));
const r=recommendLoop(urban,'1',15);
assert.ok(!r || r.kind==='out_and_back');
const ngii=buildGraph([{...elems[0],tags:{highway:'unclassified','nightpath:source':'NGII_2025_road_centerline'}}],[],C,{urbanOnly:true});
assert.equal(ngii.edges.length,1);
console.log('PASS urban filtering, evidence constraints, no fabricated loop', {all:all.edges.length,urban:urban.edges.length});
