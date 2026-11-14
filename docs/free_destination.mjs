// Arbitrary destination route comparison on the EXISTING local walking graph.
// Does not geocode, fetch new data, or assert that the route is safe or lit.
import {nearestNode,brightestWithinDetour,distanceMeters} from './routing.mjs';

export function computeDestinationRoutes(graph,startCoordinate,destinationCoordinate,{maxStartSnapMeters=220,maxEndSnapMeters=120,maxDetour=.35}={}){
  if(!graph?.nodes?.size||!graph?.edges?.length)throw new Error('보행 후보망이 준비되지 않았습니다. OSM 자료를 확인해 주세요.');
  const start=nearestNode(graph,startCoordinate,maxStartSnapMeters);
  if(!start)throw new Error(`출발지에서 ${maxStartSnapMeters}m 이내에 연결 가능한 보행 후보 도로가 없습니다.`);
  const destination=nearestNode(graph,destinationCoordinate,maxEndSnapMeters);
  if(!destination)throw new Error(`도착지에서 ${maxEndSnapMeters}m 이내에 연결 가능한 보행 후보 도로가 없습니다. 다른 곳을 찍어 주세요.`);
  if(start.id===destination.id)throw new Error('출발점과 도착지가 같은 도로 노드에 연결됩니다. 조금 더 먼 도착지를 선택해 주세요.');
  const pair=brightestWithinDetour(graph,start.id,destination.id,maxDetour);
  if(!pair?.shortest?.coords?.length||!pair?.route?.coords?.length)throw new Error('출발지와 도착지가 보행망으로 연결되지 않았습니다. 도로망 또는 도착지를 바꿔 주세요.');
  const samePath=pair.shortest.ids.length===pair.route.ids.length&&pair.shortest.ids.every((n,i)=>n===pair.route.ids[i]);
  return {shortest:pair.shortest,bright:pair.route,samePath,startNode:start.id,endNode:destination.id,startSnapDistance:distanceMeters(startCoordinate,graph.nodes.get(start.id)),endSnapDistance:distanceMeters(destinationCoordinate,graph.nodes.get(destination.id)),maxDetour};
}
