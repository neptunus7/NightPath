import assert from 'node:assert/strict';
import {createNightLightsLayer} from '../nowon/light_canvas.mjs';
// Mimic the crucial Leaflet 1.9.4 _addTile registration ordering:
// first createTile, THEN register in this._tiles. Sync callbacks are too early.
let drawn=0,readyCalls=0;
const fakeContext={setTransform(){},beginPath(){},arc(){},fill(){},drawImage(){drawn++;},createRadialGradient(){return {addColorStop(){}}}};
globalThis.document={createElement(){return {style:{},width:0,height:0,getContext(){return fakeContext}}}};
globalThis.window={devicePixelRatio:1};
const panes=new Map();
const map={getPane(key){return panes.get(key)},createPane(key){const pane={style:{}};panes.set(key,pane);return pane},
  project([lat,lon],zoom){return {x:lon*256,y:lat*256}},getBounds(){return {contains(){return true}}},latLngToContainerPoint([lat,lon]){return {x:lon*256,y:lat*256}}};
class MockGrid{
  constructor(options){this.initialize(options)}initialize(options){this.options=options;this._tiles=new Map()}
  redraw(){}
  addTo(){return this}
  _tileReady(coords){readyCalls++;assert.ok(this._tiles.has(`${coords.x}/${coords.y}`),'tile must have been registered before ready')}
  _addTile(coords){
    const key=`${coords.x}/${coords.y}`;
    const tile=this.createTile(coords,(error,t)=>this._tileReady(coords,error,t));
    this._tiles.set(key,tile);
    if(this.createTile.length<2)this._tileReady(coords,null,tile);
    return tile;
  }
}
const L={GridLayer:MockGrid};L.GridLayer.extend=methods=>{class Custom extends MockGrid{}Object.assign(Custom.prototype,methods);return Custom};
const layer=createNightLightsLayer(L,map);
assert.equal(layer.createTile.length,1,'Leaflet must recognize synchronous createTile and schedule ready after registration');
layer.update([{lat:37+24/256,lon:127+26/256,category:'ngii_security',radius:8}],{glow:true,halo:true,intensity:70});
const tile=layer._addTile({x:127,y:37,z:15});
assert.equal(tile.width,256);assert.ok(drawn>0,'visible light pixels must be drawn');assert.equal(readyCalls,1,'tile must transition to ready');
console.log('PASS Leaflet tile lifecycle: registered before ready, lamp sprite painted');
