import assert from 'node:assert/strict';
import {createNightLightsLayer,localTilePoint,zoomLightStyle,binVisibleLights} from '../nowon/light_canvas.mjs';
assert.deepEqual(localTilePoint({x:127*256+18,y:37*256+33},{x:127,y:37,z:15}),{x:18,y:33});
const coords={x:127,y:37,z:15},points=[{x:30,y:35},{x:100,y:55}];
assert.deepEqual(points.map(p=>localTilePoint(p,coords)),[{x:30-127*256,y:35-37*256},{x:100-127*256,y:55-37*256}]);
// Mock minimum Leaflet/Canvas API to prove the renderer produces tile-world,
// not container-point, positions and does not need map.moveend to reposition.
let drawn=[];
const mockContext={setTransform(){},beginPath(){},arc(){},fill(){},drawImage(_s,x,y){drawn.push([x,y]);},createRadialGradient(){return {addColorStop(){}};}};
globalThis.document={createElement(){return {width:0,height:0,style:{},getContext(){return mockContext;}};}};
globalThis.window={devicePixelRatio:1};
const panes=new Map();const map={getPane(n){return panes.get(n)},createPane(n){const p={style:{}};panes.set(n,p);return p},
 project([lat,lon],zoom){return {x:lon*256,y:lat*256}},getBounds(){return {contains(){return true}}},
 latLngToContainerPoint([lat,lon]){return {x:lon*256,y:lat*256}}};
class FakeGrid{constructor(opts){this.initialize(opts)}initialize(options){this.options=options}redraw(){this.redrawCalls=(this.redrawCalls||0)+1}addTo(){return this}}
const L={GridLayer:FakeGrid};L.GridLayer.extend=methods=>{class Custom extends FakeGrid{}Object.assign(Custom.prototype,methods);return Custom;};
const layer=createNightLightsLayer(L,map);
assert.equal(layer.options.pane,'nightpathLightPane');
layer.update([{lat:37+30/256,lon:127+20/256,category:'ngii_street',radius:15}],{halo:true,glow:true,intensity:70});
let tile=layer.createTile(coords);
assert.equal(tile.width,256);assert.ok(drawn.some(([x,y])=>Math.abs(x-20)<10&&Math.abs(y-30)<10),'tile at absolute world coordinate');
const previous=layer.redrawCalls;layer.update(layer._records,{halo:true,glow:false,intensity:10});
assert.equal(layer.redrawCalls,previous+1,'changing visual effect rerenders tiles');
assert.equal(zoomLightStyle(12).core<zoomLightStyle(15).core,true);
assert.ok(binVisibleLights([{x:11,y:10,category:'ngii_security'},{x:12,y:11,category:'ngii_street'}],12).length===1);
console.log('PASS tiled pan/zoom coordinate logic and visual-only strength controls');
