// Use built‑in fetch (available in Node 18+)


async function request(method, path, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers }, redirect: 'manual' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch('http://localhost:3000' + path, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return {res, json, text};
}

(async () => {
  console.log('--- Step 1: family login ---');
  let r = await request('POST', '/api/auth/login', {email:'family@demo.com', password:'Demo@1234'});
  if (r.res.status !== 200) { console.error('family login failed', r.res.status, r.text); process.exit(1); }
  const familyCookie = r.res.headers.get('set-cookie').split(';')[0];
  console.log('family cookie', familyCookie);

  r = await request('GET', '/api/auth/me', undefined, { Cookie: familyCookie });
  if (r.res.status !== 200) { console.error('family me failed', r.res.status, r.text); process.exit(1); }
  const circles = r.json.circles;
  const adminCircle = circles.find(c=>c.role==='admin');
  if (!adminCircle) { console.error('family not admin'); process.exit(1); }
  console.log('family circle admin ok');

  console.log('--- Step 2: get circle with admin ---');
  r = await request('GET', `/api/circles/${adminCircle.id}`, undefined, { Cookie: familyCookie });
  if (r.res.status !== 200) { console.error('get circle admin failed', r.res.status, r.text); process.exit(1); }
  if (!r.json.circle.join_code) { console.error('admin should see join_code'); process.exit(1); }
  console.log('admin sees join_code', r.json.circle.join_code);

  console.log('--- Step 3: priya login (editor) ---');
  r = await request('POST', '/api/auth/login', {email:'priya@demo.com', password:'Demo@1234'});
  if (r.res.status !== 200) { console.error('priya login failed', r.res.status, r.text); process.exit(1); }
  const priyaCookie = r.res.headers.get('set-cookie').split(';')[0];
  r = await request('GET', `/api/circles/${adminCircle.id}`, undefined, { Cookie: priyaCookie });
  if (r.res.status !== 200) { console.error('priya get circle failed', r.res.status, r.text); process.exit(1); }
  if (r.json.circle.join_code) { console.error('editor should NOT see join_code'); process.exit(1); }
  console.log('editor does not see join_code');

  console.log('--- Step 4: elder login correct ---');
  r = await request('POST', '/api/auth/elder-login', {code:'KAMLA726', pin:'1234'});
  if (r.res.status !== 200) { console.error('elder login correct failed', r.res.status, r.text); process.exit(1); }
  const elderCookie = r.res.headers.get('set-cookie').split(';')[0];
  console.log('elder login ok');

  console.log('--- Step 5: elder login wrong pin ---');
  r = await request('POST', '/api/auth/elder-login', {code:'KAMLA726', pin:'0000'});
  if (r.res.status !== 401) { console.error('elder wrong pin should be 401', r.res.status, r.text); process.exit(1); }
  console.log('elder wrong pin correctly rejected');

  console.log('--- Step 6: new user register and join ---');
  r = await request('POST', '/api/auth/register', {name:'New User', email:'new@demo.com', password:'Demo@1234'});
  if (r.res.status !== 201) { console.error('new register failed', r.res.status, r.text); process.exit(1); }
  const newCookie = r.res.headers.get('set-cookie').split(';')[0];
  r = await request('POST', '/api/circles/join', {code:'KAMLA726', relation:'Friend'}, { Cookie: newCookie });
  if (r.res.status !== 200) { console.error('join request failed', r.res.status, r.text); process.exit(1); }
  if (r.json.status !== 'pending') { console.error('join should be pending'); process.exit(1); }
  console.log('join pending');

  console.log('--- Step 7: new user cannot get circle ---');
  r = await request('GET', `/api/circles/${adminCircle.id}`, undefined, { Cookie: newCookie });
  if (r.res.status !== 403) { console.error('new user should be 403', r.res.status, r.text); process.exit(1); }
  console.log('new user blocked as expected');

  console.log('--- Step 8: admin approves new user ---');
  // get members list to find new member id
  r = await request('GET', `/api/circles/${adminCircle.id}/members`, undefined, { Cookie: familyCookie });
  if (r.res.status !== 200) { console.error('admin get members failed', r.res.status, r.text); process.exit(1); }
  const newMember = r.json.members.find(m=>m.email===undefined && m.role==='viewer' && m.status==='pending');
  // fallback: find by name not available, use relation maybe 'Friend'
  const pending = r.json.members.find(m=>m.relation==='Friend' && m.status==='pending');
  const memId = pending.id;
  r = await request('PATCH', `/api/circles/${adminCircle.id}/members/${memId}`, {status:'active', role:'editor'}, { Cookie: familyCookie });
  if (r.res.status !== 200) { console.error('admin approve failed', r.res.status, r.text); process.exit(1); }
  console.log('admin approved member');

  console.log('--- Step 9: new user now can get circle ---');
  r = await request('GET', `/api/circles/${adminCircle.id}`, undefined, { Cookie: newCookie });
  if (r.res.status !== 200) { console.error('new user should now succeed', r.res.status, r.text); process.exit(1); }
  console.log('new user can access circle');

  console.log('All verification steps passed');
})();
