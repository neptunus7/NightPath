// NIGHTPATH Leaflet-tile-synced lighting overlay.
// Actual lamp positions are source records; visual bloom is an illustration, not lux or live status.
// L.GridLayer tiles stay attached to the basemap during dragging AND animated zoom.
// When zoomed far out, multiple lamps merge into diffuse light patches instead
// of large hard dots. No inferred luminance or time state is added to the data.
export function zoomLightStyle(z){
  if(z<=10)return {core:.10,glow:10.5,spacing:18,opacity:.65,clusters:true,haze:true};
  if(z<=11)return {core:.13,glow:9.0,spacing:15,opacity:.70,clusters:true,haze:true};
  if(z<=12)return {core:.17,glow:7.3,spacing:13,opacity:.74,clusters:true,haze:true};
  if(z<=13)return {core:.23,glow:5.2,spacing:9,opacity:.78,clusters:true,haze:true};
  if(z<=14)return {core:.38,glow:3.1,spacing:0,opacity:.85,clusters:false,haze:false};
  if(z<=15)return {core:.45,glow:3.7,spacing:0,opacity:.90,clusters:false,haze:false};
  if(z<=16)return {core:.56,glow:4.4,spacing:0,opacity:.94,clusters:false,haze:false};
  return {core:Math.min(.85,.65+(z-17)*.05),glow:5,spacing:0,opacity:.96,clusters:false,haze:false};
}
// The 100% control corresponds to ~70% of the v0.8.12.2 strength.
// Purely a *rendering* change, never a radius/score change.
export function effectiveVisualStrength(value){
  return Math.max(0,Math.min(100,Number(value)||0))*.70;
}
// v0.8.12.5: 50% of the new slider matches 100% of v0.8.12.4;
// 70% default gives 1.4x the previous maximum. Decorative ONLY.
export function effectiveHaloStrength(value){
  return effectiveVisualStrength(value)*(100/35)*2;
}
// Each modeled radius retains its spatial extent but fades towards its edge.
// Returns relative alpha, not light intensity or lux.
export function haloGradientStops(centerAlpha){
  return [[0,centerAlpha],[.35,centerAlpha*.88],[.72,centerAlpha*.38],[1,0]];
}
// A tiny colored core identifies the source. The surrounding glow imitates
// the user's neighborhood observation: security lights white, streetlights amber,
// manually time-checked convenience stores soft blue. This is NOT photometry.
const COLORS={ngii_street:[255,207,118],ngii_security:[169,157,255],iot:[112,190,247],legacy_safety:[226,187,255],osm:[147,222,173],additional:[153,221,212],shop_light:[144,215,255]};
export const LIGHT_BLOOM_BY_CATEGORY=Object.freeze({
  ngii_street:[255,217,142],
  ngii_security:[248,250,255],
  iot:[245,249,255],
  legacy_safety:[248,250,255],
  osm:[249,239,210],
  additional:[247,246,225],
  shop_light:[159,214,255]
});
export function bloomColor(category='additional'){return LIGHT_BLOOM_BY_CATEGORY[category]||LIGHT_BLOOM_BY_CATEGORY.additional;}
// A storefront coordinate may be a shop centroid rather than the actual door.
// Therefore this radius only scales the illustrative light graphic, not routing.
export const SHOP_LIGHT_RADII_METERS=Object.freeze([3,6,10,15]);
export function shopGlowRadiusPx(z,radiusMeters=6){
  const meters=SHOP_LIGHT_RADII_METERS.includes(Number(radiusMeters))?Number(radiusMeters):6;
  return Math.min(55,Math.max(zoomLightStyle(z).glow,meters/metersPerPixel(37.65,z)*1.1));
}
export function metersPerPixel(lat,z){return 40075016.686*Math.cos(lat*Math.PI/180)/(256*2**z);}
export function binVisibleLights(records,z){
  const cfg=zoomLightStyle(z);if(!cfg.clusters)return records;
  const map=new Map();
  for(const p of records){const key=Math.floor(p.x/cfg.spacing)+','+Math.floor(p.y/cfg.spacing);
    const old=map.get(key);if(!old)map.set(key,{...p,count:1});
    else {old.count++;if((COLORS[p.category]?.[0]||0)>(COLORS[old.category]?.[0]||0))old.category=p.category;}
  }
  return [...map.values()];
}
// Tile/world point math is deliberately independent of map drag offset.
export function localTilePoint(world,coords,tileSize=256){return {x:world.x-coords.x*tileSize,y:world.y-coords.y*tileSize};}
const sprites=new Map();
function spriteFor(category,z,glowOn,dpr,strength,radiusMeters=6){
  const cfg=zoomLightStyle(z),s=Math.max(0,Math.min(100,Number(strength)||0));
  const key=[category,z,glowOn,dpr,s,category==='shop_light'?radiusMeters:'public'].join('|');if(sprites.has(key))return sprites.get(key);
  const zoomRadius=category==='shop_light'?shopGlowRadiusPx(z,radiusMeters):cfg.glow*(.86+s/190),r=glowOn?zoomRadius:0;
  const farFactor=cfg.haze?(z<=11?.25:z===12?.33:.45):1;
  const pad=Math.max(r,cfg.core)+2,size=Math.ceil(pad*2*dpr);
  const c=document.createElement('canvas');c.width=c.height=size;
  const g=c.getContext('2d'),mid=size/2,rgb=(COLORS[category]||COLORS.additional).join(','),bloom=bloomColor(category).join(',');
  if(glowOn&&r>0){
    const gradient=g.createRadialGradient(mid,mid,0,mid,mid,r*dpr);
    const alpha=((category==='shop_light'?.34:.50)+(category==='shop_light'?.33:.40)*s/100)*farFactor;gradient.addColorStop(0,`rgba(${bloom},${alpha.toFixed(3)})`);
    gradient.addColorStop(.22,`rgba(${bloom},${(((category==='shop_light'?.13:.20)+(.32*s/100))*farFactor).toFixed(3)})`);
    gradient.addColorStop(.55,`rgba(${bloom},${((.07+.17*s/100)*farFactor).toFixed(3)})`);
    gradient.addColorStop(1,`rgba(${bloom},0)`);
    g.fillStyle=gradient;g.beginPath();g.arc(mid,mid,r*dpr,0,2*Math.PI);g.fill();
  }
  g.fillStyle=`rgba(${rgb},${cfg.haze?.48:.94})`;g.beginPath();g.arc(mid,mid,cfg.core*dpr,0,2*Math.PI);g.fill();
  sprites.set(key,c);if(sprites.size>2000)sprites.clear();return c;
}
export function createNightLightsLayer(L,map){
  if(!map.getPane('nightpathLightPane')){const pane=map.createPane('nightpathLightPane');pane.style.zIndex='350';pane.style.pointerEvents='none';}
  const NightLights=L.GridLayer.extend({
    initialize(options){L.GridLayer.prototype.initialize.call(this,{pane:'nightpathLightPane',tileSize:256,keepBuffer:2,updateWhenIdle:false,updateWhenZooming:true,...options});this._records=[];this._glow=true;this._halo=true;this._strength=10;this._haloIntensity=70;this._cache=new Map();},
    update(records,{halo=true,glow=true,intensity=10,haloIntensity=70}={}){
      this._records=records||[];this._halo=halo;this._glow=glow;this._strength=intensity;const h=Number(haloIntensity);this._haloIntensity=Number.isFinite(h)?Math.max(0,Math.min(100,h)):70;this._cache.clear();this.redraw();
    },
    _projected(z){
      if(this._cache.has(z))return this._cache.get(z);
      const projected=this._records.map(p=>({...p,...map.project([p.lat,p.lon],z)}));
      this._cache.set(z,projected);if(this._cache.size>5)this._cache.delete(this._cache.keys().next().value);
      return projected;
    },
    // Synchronous GridLayer tile: do NOT call a done callback here.
    // Leaflet registers the tile in _tiles only AFTER createTile returns.
    // Calling done synchronously (previous v0.8.10–0.8.12 code) invoked
    // _tileReady too early, leaving the lamp layer transparent/invisible.
    // With one argument, Leaflet schedules _tileReady on its own next frame.
    createTile(coords){
      const tile=document.createElement('canvas'),px=256,dpr=Math.min(2,window.devicePixelRatio||1);
      tile.width=px*dpr;tile.height=px*dpr;tile.style.width=px+'px';tile.style.height=px+'px';
      const ctx=tile.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
      const z=coords.z,style=zoomLightStyle(z),points=[],margin=72;
      for(const p of this._projected(z)){
        const local=localTilePoint(p,coords,px);
        if(local.x < -margin || local.y < -margin || local.x > px+margin || local.y > px+margin)continue;
        points.push({...p,x:local.x,y:local.y});
      }
      const visible=binVisibleLights(points,z);
      if(this._halo){
        // Mandatory hypothetical proximity field. At small zooms its projected
        // radius is subpixel, never a fabricated real illuminance footprint.
        for(const p of visible){
          const radius=Math.min(65,Math.max(.5,(p.radius||8)/metersPerPixel(p.lat,z)));
          if(radius<1)continue;
          const color=bloomColor(p.category).join(',');
          const displayStrength=effectiveHaloStrength(this._haloIntensity);
          const alpha=Math.min(.21,(z>=16?.027:.010)*(displayStrength/40));
          const field=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
          for(const [stop,opacity] of haloGradientStops(alpha))field.addColorStop(stop,`rgba(${color},${opacity.toFixed(4)})`);
          ctx.fillStyle=field;
          ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.globalAlpha=style.opacity;
      for(const p of visible){
        const sprite=spriteFor(p.category,z,this._glow,dpr,this._strength,p.radius),w=sprite.width/dpr;
        ctx.drawImage(sprite,p.x-w/2,p.y-w/2,w,w);
      }
      ctx.globalAlpha=1;
      return tile;
    },
    findNearest(latlng,maxPixel=9){
      const here=map.latLngToContainerPoint(latlng);let closest=null,dist=maxPixel;
      const extent=map.getBounds();
      for(const p of this._records){
        if(!extent.contains([p.lat,p.lon]))continue;
        const v=map.latLngToContainerPoint([p.lat,p.lon]);const d=Math.hypot(v.x-here.x,v.y-here.y);
        if(d<dist){dist=d;closest=p;}
      }
      return closest;
    }
  });
  return new NightLights({zIndex:340}).addTo(map);
}
