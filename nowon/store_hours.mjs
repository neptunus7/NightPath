// User-provided, ephemeral schedule preview. No third-party map scraping or persistence.
// Open does not imply that street illumination exists. All displayed light is illustrative.
export function parseDailyRange(text){
  const m=String(text||'').trim().match(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/);
  if(!m)return null;
  const start=Number(m[1])*60+Number(m[2]),end=Number(m[3])*60+Number(m[4]);
  return start===end?null:{start,end};
}
export function isOpenAt(assessment,time){
  if(!assessment||assessment.type==='unknown')return false;
  if(assessment.type==='247')return true;
  if(assessment.type!=='daily')return false;
  const r=parseDailyRange(assessment.range),m=String(time||'').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if(!r||!m)return false;
  const at=Number(m[1])*60+Number(m[2]);
  return r.start<r.end ? at>=r.start&&at<r.end : at>=r.start||at<r.end;
}

// DEMO ONLY: full-day appearance never asserts a store is currently open.
export function showShopLightAt(assessment,time,demoAllDay=false){
  return Boolean(demoAllDay)||isOpenAt(assessment,time);
}
