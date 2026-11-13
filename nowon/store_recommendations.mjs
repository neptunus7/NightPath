// Presentation-only selection: show nearby eligible shops as well as high light-score shops.
// Input has already passed OSM tagging, walk-network snapping, and the walking-distance filter.
// Does NOT change light scoring, opening-hours assumptions, or accessibility verification.
export function pickStoreRecommendations(candidates,limit=8,nearestCount=2){
  const nearest=[...candidates].sort((a,b)=>a.shortest.distance-b.shortest.distance).slice(0,nearestCount);
  const keys=new Set(nearest.map(s=>s.id));
  return [...nearest,...candidates.filter(s=>!keys.has(s.id))].slice(0,limit);
}
