// smoke.js – simple end‑to‑end test script

// Using built-in fetch (Node 18+)
const BASE = process.env.BASE || 'http://localhost:3000';

function log(msg) { console.log(msg); }

async function run() {
  // 1 register random user
  const email = `smoke${Date.now()}@test.com`;
  let r = await fetch(`${BASE}/api/auth/register`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Smoke',email,password:'Demo@1234'})});
  if (r.status!==201) { console.error('✗ register'); process.exit(1); } else log('✓ register');
  const setCookie = r.headers.get('set-cookie');
  const token = setCookie && setCookie.split(';')[0];

  // helper request with token
  const req = async (method, path, body) => {
    const opts = {method, headers:{'Content-Type':'application/json','Cookie': token}};
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${BASE}${path}`, opts);
    const txt = await resp.text();
    let json = null; try { json = JSON.parse(txt); } catch (_) {}
    return {resp, json, txt};
  };

  // 2 GET /auth/me
  r = await req('GET','/api/auth/me');
  if (r.resp.status!==200) { console.error('✗ me'); process.exit(1); } else log('✓ me');

  // 3 create circle (pin 4321)
  r = await req('POST','/api/circles',{elder_name:'Elder',elder_pin:'4321'});
  if (r.resp.status!==201) { console.error('✗ create circle'); process.exit(1); } else log('✓ circle');
  const cid = r.json.circle.id;
  const join_code = r.json.circle.join_code;

  // 4 add medication
  const now = new Date();
  const offset = process.env.APP_TZ_OFFSET_MIN ? parseInt(process.env.APP_TZ_OFFSET_MIN) : 330;
  const local = new Date(now.getTime() + offset*60000);
  let hh = String(local.getUTCHours()).padStart(2,'0');
  let mm = String(local.getUTCMinutes()-5).padStart(2,'0');
  if (parseInt(mm)<0) { mm='00'; }
  const time = `${hh}:${mm}`;
  r = await req('POST',`/api/circles/${cid}/medications`,{name:'Metformin',dosage:'500 mg',times:[time]});
  if (r.resp.status!==201) { console.error('✗ add med'); process.exit(1); } else log('✓ med');
  const medId = r.json.medication.id;

  // 5 GET today doses
  r = await req('GET',`/api/circles/${cid}/today`);
  if (r.resp.status!==200) { console.error('✗ today'); process.exit(1); } else log('✓ today');
  const logId = r.json.doses.find(d=>d.medication_id===medId).log_id;

  // 6 take dose
  r = await req('POST',`/api/circles/${cid}/doses/${logId}/take`,{});
  if (r.resp.status!==200) { console.error('✗ take'); process.exit(1); } else log('✓ take');

  // 7 take again → 409
  r = await req('POST',`/api/circles/${cid}/doses/${logId}/take`,{});
  if (r.resp.status!==409) { console.error('✗ double take not 409'); process.exit(1); } else log('✓ double take 409');

  // 8 medication check warfarin
  r = await req('POST',`/api/circles/${cid}/medications/check`,{name:"Warfarin"});
  if (r.resp.status!==200) { console.error('✗ med check'); process.exit(1); } else log('✓ med check');

  // 9 elder login
  r = await fetch(`${BASE}/api/auth/elder-login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:join_code,pin:'4321'})});
  if (r.status!==200) { console.error('✗ elder login'); process.exit(1); } else log('✓ elder login');
  const elderCookie = r.headers.get('set-cookie').split(';')[0];

  // 10 elder GET today
  const elderReq = async (method,path,body) => {
    const opts = {method, headers:{'Content-Type':'application/json','Cookie':elderCookie}};
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${BASE}${path}`, opts);
    const txt = await resp.text();
    let json = null; try { json = JSON.parse(txt); } catch (_) {}
    return {resp, json, txt};
  };
  r = await elderReq('GET',`/api/circles/${cid}/today`);
  if (r.resp.status!==200) { console.error('✗ elder today'); process.exit(1); } else log('✓ elder today');

  // 11 elder mood
  r = await elderReq('POST',`/api/circles/${cid}/mood`,{mood:4});
  if (r.resp.status!==201) { console.error('✗ elder mood'); process.exit(1); } else log('✓ elder mood');

  // 12 elder try add medication → 403
  r = await elderReq('POST',`/api/circles/${cid}/medications`,{name:'Aspirin'});
  if (r.resp.status!==403) { console.error('✗ elder med not 403'); process.exit(1); } else log('✓ elder med 403');

  // 13 SOS from elder
  r = await elderReq('POST',`/api/circles/${cid}/sos`,{});
  if (r.resp.status!==201) { console.error('✗ sos'); process.exit(1); } else log('✓ sos');

  // 14 admin GET outbox
  r = await req('GET',`/api/circles/${cid}/outbox`);
  if (r.resp.status!==200 || (r.json.emails||[]).length===0) { console.error('✗ outbox'); process.exit(1); } else log('✓ outbox');

  // 15 demo tick
  r = await req('POST',`/api/circles/${cid}/demo/tick`,{offset_minutes:65});
  if (r.resp.status!==200) { console.error('✗ demo tick'); process.exit(1); } else log('✓ demo tick');

  // 16 logout
  r = await req('POST','/api/auth/logout',{});
  if (r.resp.status!==200) { console.error('✗ logout'); process.exit(1); } else log('✓ logout');

  // 17 GET me → 401
  r = await req('GET','/api/auth/me');
  if (r.resp.status!==401) { console.error('✗ post‑logout me not 401'); process.exit(1); } else log('✓ post‑logout 401');

  console.log('ALL SMOKE TESTS PASSED');
}

run().catch(e=>{console.error('✗ error',e); process.exit(1);});
