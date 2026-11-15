# SAATHI — SHARED CONTRACT (single source of truth)

Every agent reads this fully before writing code. Never change a name, path, route, field, or signature in this file.

## 0. Product in one paragraph
Saathi is a web app for elderly medication and healthcare management. One elder has a **Care Circle**. Family/caretakers join with a **join code**, get approved, and manage medicines/appointments. The elder uses **Easy Mode** (Circle code + 4-digit PIN) with huge buttons. The server sends **email reminders** (due, nudge, missed, appointment, low stock, SOS). Gemini features are optional and always have a fallback.

## 1. Stack (fixed)
- Node 18+ (CommonJS), Express **4**, better-sqlite3, bcryptjs, jsonwebtoken, cookie-parser, dotenv, express-rate-limit, multer (memoryStorage), node-cron, nodemailer. No other packages.
- Frontend: plain HTML + CSS + ES modules. **No framework, no bundler, no CDN, no external fonts or images.** Hash routing (`#/...`).
- DB: SQLite file `data/saathi.db`. Timezone: fixed offset `APP_TZ_OFFSET_MIN` (default 330 = IST). All dates are local strings: date `YYYY-MM-DD`, time `HH:MM`, datetime `YYYY-MM-DDTHH:MM`.
- Server port 3000. Static files from `public/`.

## 2. File layout and OWNERSHIP
```
saathi/
  package.json .env.example .gitignore README.md server.js          [Agent 1]
  docs/CONTRACT.md                                                   [given]
  src/db.js src/schema.sql src/seed.js                               [Agent 1]
  src/lib/time.js auth.js activity.js mail.js gemini.js              [Agent 1]
  src/lib/interactions.js src/lib/doselogic.js                       [Agent 3]
  src/lib/notify.js src/lib/scheduler.js                             [Agent 4]
  src/routes/auth.js circles.js members.js                           [Agent 2]
  src/routes/meds.js doses.js appointments.js mood.js                [Agent 3]
  src/routes/insights.js ai.js ops.js                                [Agent 4]
  test/smoke.js                                                      [Agent 4]
  public/index.html css/app.css js/api.js js/ui.js js/i18n.js        [Agent 1]
  public/css/elder.css js/main.js                                    [Agent 5]
  public/js/pages/landing.js login.js register.js elder-login.js setup.js   [Agent 5]
  public/js/elder/home.js meds.js visits.js mood.js help.js circle.js       [Agent 5]
  public/css/family.css                                              [Agent 6]
  public/js/family/dashboard.js overview.js medicines.js appointments.js circle.js activity.js reports.js printviews.js  [Agent 6]
```
An agent writes only files it owns. Agent 1 also creates **stub files** for every file owned by Agents 2–6 so the server boots at all times (Router stubs export an empty `express.Router({mergeParams:true})`; lib stubs export the functions below returning harmless defaults; page stubs export the render function below rendering a `<p>stub</p>`). The owner overwrites its stub.

## 3. Environment variables (.env.example)
```
PORT=3000
JWT_SECRET=change-me-please
APP_URL=http://localhost:3000
APP_TZ_OFFSET_MIN=330
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Saathi <your@gmail.com>
```

## 4. Database schema (copy exactly into src/schema.sql)
```sql
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS circles(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  elder_name TEXT NOT NULL,
  elder_age INTEGER,
  elder_email TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  join_code TEXT NOT NULL UNIQUE,
  elder_pin_hash TEXT NOT NULL,
  blood_group TEXT, conditions TEXT, allergies TEXT,
  doctor_name TEXT, doctor_phone TEXT, emergency_notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS members(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  status TEXT NOT NULL CHECK(status IN ('pending','active','revoked')),
  relation TEXT,
  notify_missed INTEGER NOT NULL DEFAULT 1,
  notify_upcoming INTEGER NOT NULL DEFAULT 0,
  notify_appointments INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(circle_id,user_id)
);
CREATE TABLE IF NOT EXISTS medications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  form TEXT NOT NULL DEFAULT 'tablet',
  appearance TEXT,
  instructions TEXT NOT NULL DEFAULT 'anytime',
  purpose TEXT,
  times TEXT NOT NULL,
  days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  start_date TEXT, end_date TEXT,
  pills_left INTEGER, pills_per_dose INTEGER NOT NULL DEFAULT 1,
  refill_threshold INTEGER NOT NULL DEFAULT 5,
  color TEXT DEFAULT '#0F766E',
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dose_logs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','taken','skipped','missed')),
  taken_at TEXT, logged_by TEXT, note TEXT, snoozed_until TEXT,
  UNIQUE(medication_id,scheduled_date,scheduled_time)
);
CREATE TABLE IF NOT EXISTS appointments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  doctor TEXT NOT NULL, specialty TEXT, location TEXT,
  datetime TEXT NOT NULL,
  purpose TEXT,
  questions TEXT NOT NULL DEFAULT '[]',
  accompanied_by TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','done','cancelled')),
  outcome_notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mood_checkins(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  date TEXT NOT NULL, mood INTEGER NOT NULL CHECK(mood BETWEEN 1 AND 5), note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  actor TEXT, action TEXT NOT NULL, detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notification_log(
  key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outbox(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER, to_email TEXT NOT NULL, subject TEXT NOT NULL,
  body_text TEXT, body_html TEXT, kind TEXT,
  sent INTEGER NOT NULL DEFAULT 0, error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sos_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  triggered_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT, resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dose_circle_date ON dose_logs(circle_id,scheduled_date);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
```

## 5. Global API conventions
- Base `/api`. JSON in/out. Errors: `{ "error": "Human readable message" }` with status 400 validation, 401 not signed in, 403 forbidden, 404 not found, 409 conflict, 429 rate limit.
- Auth = httpOnly cookie `token` (JWT). Payload `{kind:'user',uid}` (7 days) or `{kind:'elder',cid}` (30 days).
- Circle routes use `requireCircle(action)` from `src/lib/auth.js`. Actions: `read` (admin, editor, viewer, elder), `log` (admin, editor, elder), `edit` (admin, editor), `admin` (admin). It sets `req.ctx = {kind, userId?, memberId?, circleId, role, label}` and `req.cid`.
- Never return `password_hash`, `elder_pin_hash`. Only admins receive `join_code`.
- Parameterized SQL only. Never build SQL from user input.
- Frontend `api` helper takes paths **without** the `/api` prefix.
- JSON-in-TEXT columns (`times`, `days_of_week`, `questions`) are parsed to arrays in every API response and stringified on write.

### 5.1 Auth  (`src/routes/auth.js`, mounted `/api/auth`)
| Method Path | Body → Response |
|---|---|
| POST /register | `{name,email,password,phone?}` → 201 `{user:{id,name,email}}` + cookie. Password min 8, email valid, duplicate email → 409 |
| POST /login | `{email,password}` → `{user}` + cookie. Wrong → 401 "Wrong email or password" |
| POST /elder-login | `{code,pin}` → `{circle:{id,elder_name,language}}` + elder cookie. Code case-insensitive. Wrong → 401 "Wrong code or PIN". Rate limited |
| POST /logout | → `{ok:true}`, clears cookie |
| GET /me | user → `{kind:'user',user:{id,name,email,phone},circles:[{id,elder_name,role,status,relation}]}` (all statuses except revoked). elder → `{kind:'elder',circle:{id,elder_name,language}}`. none → 401 |

### 5.2 Circles & members  (`circles.js` mounted `/api/circles`, `members.js` mounted `/api/circles/:cid/members`)
| Method Path | Perm | Body → Response |
|---|---|---|
| POST /api/circles | signed-in user | `{elder_name,elder_age?,elder_email?,language?('en'\|'hi'),blood_group?,conditions?,allergies?,doctor_name?,doctor_phone?,emergency_notes?,elder_pin (exactly 4 digits),relation}` → 201 `{circle}` (includes `join_code`). Creator becomes member role `admin`, status `active` |
| POST /api/circles/join | signed-in user | `{code,relation,requested_role:'editor'\|'viewer'}` → `{status:'pending'\|'active'\|'revoked',circle_name}`. New joins are `pending`. Already a member → returns current status. Unknown code → 404 "Code not found". Rate limited |
| GET /api/circles/:cid | read | → `{circle:{id,elder_name,elder_age,elder_email,language,blood_group,conditions,allergies,doctor_name,doctor_phone,emergency_notes,join_code?(admin only),my_role}}` |
| PATCH /api/circles/:cid | admin | any editable field above incl. `elder_pin` (rehash) → `{circle}` |
| POST /api/circles/:cid/rotate-code | admin | → `{join_code}` |
| GET …/members | read | → `{members:[{id,name,relation,role,status,phone,email?,notify_missed,notify_upcoming,notify_appointments}]}`. `email` only for admin/editor. Elder/viewer: only `status:'active'`, fields `{id,name,relation,role,phone}` |
| PATCH …/members/:mid | admin | `{role?,status?('active'\|'revoked')}` → `{member}`. Cannot change/revoke the last active admin → 400 |
| PATCH …/members/me/prefs | user member | `{notify_missed?,notify_upcoming?,notify_appointments?}` (0/1) → `{ok:true}` |
| DELETE …/members/me | user member | leaves the circle (status `revoked`); last admin cannot leave → 400 |

### 5.3 Medications  (`meds.js`, mounted `/api/circles/:cid/medications`)
Medication object: `{id,circle_id,name,dosage,form,appearance,instructions,purpose,times:["08:00"],days_of_week:[0..6],start_date,end_date,pills_left,pills_per_dose,refill_threshold,color,notes,active,created_at}`
- `form` ∈ tablet, capsule, syrup, injection, drops, inhaler, other.
- `instructions` ∈ with_food, before_food, after_food, empty_stomach, bedtime, anytime.
- `times`: 1–8 items, each `HH:MM` 24h, no duplicates.

| Method Path | Perm | Body → Response |
|---|---|---|
| GET / | read | `?active=1` (default 1) → `{medications:[…]}` |
| POST / | edit | medication fields + `force?` → 201 `{medication,warnings}`. If any warning has severity `high` and `force!==true` → **409** `{error:'Safety check needs your attention',needs_force:true,warnings:[…]}` (nothing saved) |
| PATCH /:mid | edit | partial fields → `{medication}` |
| DELETE /:mid | edit | soft delete: `active=0`, deletes today's and future pending dose_logs → `{ok:true}` |
| POST /check | edit | `{name}` → `{warnings}` (checks against all active meds) |
| GET /:mid/explain | read | `?lang=en\|hi` → `{text,source:'gemini'\|'fallback'}` |

Warning object: `{severity:'high'|'moderate'|'low', kind:'interaction'|'beers'|'duplicate'|'timing', with:'Aspirin'|null, message}`. Disclaimer shown by UI: "Informational only. Please check with the doctor or pharmacist."

### 5.4 Doses  (`doses.js`, mounted `/api/circles/:cid`)
Dose object: `{log_id,medication_id,name,dosage,form,appearance,instructions,purpose,color,time,status,taken_at,logged_by,snoozed_until,is_due,minutes_overdue,pills_left}`
- `status`: pending | taken | skipped | missed. `is_due` = now ≥ scheduled time. `minutes_overdue` = max(0, now − scheduled) in minutes (0 if not due).

| Method Path | Perm | Body → Response |
|---|---|---|
| GET /today | read | → `{date,now:'HH:MM',doses:[Dose sorted by time],next:Dose\|null,summary:{total,taken,pending,missed,skipped},sos_active:boolean}`. Calls `ensureLogs(cid,today)` first. `next` = first pending dose, else null |
| POST /doses/:logId/take | log | `{note?,confirm?}` → `{dose}`. Already taken → **409** `{error:'Already taken',already_taken_at}`. **Double-dose guard**: if the same medication was taken (different slot) within the last 60 min and `confirm!==true` → **409** `{error:'This medicine was taken less than an hour ago',needs_confirm:true}` |
| POST /doses/:logId/skip | log | `{note?}` → `{dose}` |
| POST /doses/:logId/snooze | log | `{minutes}` (5–120) → `{dose}`; sets `snoozed_until` = now+minutes as `HH:MM` (cap 23:59) |
| GET /doses/history | read | `?days=14` (max 60) → `{days:[{date,total,taken,missed,skipped,pending}],adherence_pct}` ascending; `adherence_pct = round(100*taken/(taken+missed+skipped))` or `null` |
| GET /doses/log | read | `?date=YYYY-MM-DD` → `{doses:[Dose]}` |

### 5.5 Appointments  (`appointments.js`, mounted `/api/circles/:cid/appointments`)
Appointment: `{id,circle_id,doctor,specialty,location,datetime,purpose,questions:[string],accompanied_by,status,outcome_notes,created_by}`

| Method Path | Perm | Body → Response |
|---|---|---|
| GET / | read | `?status=upcoming\|done\|all` (default upcoming, sorted ascending by datetime) → `{appointments}` |
| POST / | edit | `{doctor,specialty?,location?,datetime,purpose?,questions?,accompanied_by?}` → 201 `{appointment}` |
| PATCH /:aid | edit | partial → `{appointment}` |
| DELETE /:aid | edit | sets `status='cancelled'` → `{ok:true}` |
| POST /:aid/claim | edit | sets `accompanied_by` = `req.ctx.label` → `{appointment}` |
| POST /:aid/complete | edit | `{outcome_notes?}` → `{appointment}` (status `done`) |
| GET /:aid/prep | read | → `{appointment,questions:[string],summary:{period_days:14,adherence_pct,missed:[{name,count}],mood_avg,mood_last:[{date,mood}],medications:[{name,dosage,times,instructions}],low_stock:[{name,pills_left}]},source:'gemini'\|'fallback'}` |

### 5.6 Mood  (`mood.js`, mounted `/api/circles/:cid/mood`)
- `POST /` (log) `{mood:1..5,note?}` → 201 `{mood:{id,date,mood,note}}`
- `GET /` (read) `?days=14` → `{moods:[{date,mood,note,created_at}]}` (latest entry per date, ascending)

### 5.7 Insights, activity, reports  (`insights.js`, mounted `/api/circles/:cid`)
- `GET /insights` (read) → `{adherence_7d,streak_days,missed_by_slot:{morning,afternoon,evening,night},mood:{avg_7d,last:[{date,mood}]},low_stock:[{id,name,pills_left,days_left}],flags:[{level:'warning'|'urgent',text}],overall:'good'|'attention'|'urgent'}`
  - Slots by scheduled hour: morning 5–11, afternoon 12–16, evening 17–20, night 21–4. Counts = missed doses in last 7 days.
  - `streak_days` = consecutive past days (ending yesterday) with zero missed and at least one taken.
  - `days_left = floor(pills_left / (pills_per_dose * times.length))`; low stock when `pills_left <= refill_threshold`.
  - Flags — urgent: active SOS ("SOS pressed — check on {elder} now"); ≥2 missed today. Warning: adherence_7d < 80; any slot with ≥3 misses in 7 days ("{Slot} doses are missed most often ({n} in 7 days)"); low stock ("{name} is running low (about {days_left} days left)"); last 3 moods contain ≥2 values ≤2; upcoming appointment within 24h with no `accompanied_by`.
  - `overall`: urgent if any urgent flag, else attention if any warning flag, else good.
- `GET /activity` (read) `?limit=50` → `{activity:[{id,actor,action,detail,created_at}]}` newest first.
- `GET /report/weekly` (read) → `{period:{from,to},stats:{adherence_pct,taken,missed,skipped,mood_avg,missed_by_slot},narrative,source:'gemini'|'fallback'}`

### 5.8 AI  (`ai.js`, mounted `/api/circles/:cid/ai`)
- `POST /scan-prescription` (edit), multipart field `image` (jpeg/png/webp, ≤6 MB) → `{medications:[{name,dosage,form,instructions,times:["08:00"],purpose}],source:'gemini'|'unavailable',disclaimer}`. Nothing is saved. Without a Gemini key → `{medications:[],source:'unavailable',disclaimer}`.

### 5.9 Ops  (`ops.js`, mounted `/api/circles/:cid`)
- `GET /emergency-card` (read) → `{elder:{name,age,blood_group,conditions,allergies,doctor_name,doctor_phone,emergency_notes},medications:[{name,dosage,times,instructions}],contacts:[{name,relation,phone}]}`
- `POST /sos` (log) → 201 `{sos:{id,created_at},notified:number}`. Emails all active members (not the elder). Logs activity.
- `GET /sos/active` (read) → `{sos:{id,triggered_by,created_at}|null}`
- `POST /sos/:id/resolve` (edit) → `{ok:true}`
- `GET /outbox` (edit) → `{emails:[{id,to_email,subject,body_text,kind,sent,error,created_at}]}` last 30, newest first
- `POST /demo/tick` (admin) `{offset_minutes:number}` → `await tick(new Date(Date.now()+offset*60000))` → `{ok:true,actions:[string]}` (offset must be between 1 and 180)
- `GET /api/health` → `{ok:true}` (defined in server.js)

## 6. Library function signatures
```
time.js:      OFFSET, localParts(date=new Date()) -> {date,time,minutes,dow}, toMin('HH:MM'), localToEpoch('YYYY-MM-DDTHH:MM'),
              addDays(dateStr,n), dateRange(endDate,days) -> ascending array, dowOf(dateStr), pad
auth.js:      signToken, setCookie(res,payload,days), readToken(req), authRequired, requireCircle(action), CAN
activity.js:  logActivity(circleId, actor, action, detail='')
mail.js:      sendMail({circleId,to,subject,text,html,kind}) -> Promise<{sent}>, recipientsFor(circleId, flag|null) -> [{email,name,role}]
gemini.js:    generateText(prompt) -> string|null, generateJson(prompt, image?{mimeType,base64}) -> object|null, enabled()
interactions.js: checkNewMedication(newName, existingNames[]) -> warnings[], DISCLAIMER
doselogic.js: ensureLogs(circleId,date), formatDose(row,nowParts) -> Dose, computeStats(circleId,days) -> {taken,missed,skipped,adherence_pct,missed_by_med:[{name,count}],missed_by_slot:{morning,afternoon,evening,night}}
notify.js:    notifyDue(logId), notifyNudge(logId), notifyMissed(logId), notifyRisk(circleId,date), notifyAppointment(apptId,kind:'24h'|'2h'),
              notifyLowStock(medicationId), notifySOS(sosId) -> number
scheduler.js: start(), async tick(now=new Date()) -> Promise<actions:[string]>  (awaits every notify call so emails are in the outbox when it resolves)
```
Every function in `notify.js` and `scheduler.js` must never throw (wrap in try/catch, log errors).

## 7. Frontend contract
**Routes (hash):**
`#/` landing · `#/login` · `#/register` · `#/elder-login` · `#/setup` (create or join circle) · `#/app/:cid/:tab` family dashboard (tabs: overview, medicines, appointments, circle, activity, reports) · `#/elder` · `#/elder/meds` · `#/elder/visits` · `#/elder/mood` · `#/elder/help` · `#/elder/circle` · `#/emergency/:cid` · `#/visit/:cid/:aid`

**Exports (exact):**
```
js/pages/landing.js      export function renderLanding(el)
js/pages/login.js        export function renderLogin(el)
js/pages/register.js     export function renderRegister(el)
js/pages/elder-login.js  export function renderElderLogin(el)
js/pages/setup.js        export function renderSetup(el, {me})
js/elder/home.js         export function renderElderHome(el, {me})
js/elder/meds.js         export function renderElderMeds(el, {me})
js/elder/visits.js       export function renderElderVisits(el, {me})
js/elder/mood.js         export function renderElderMood(el, {me})
js/elder/help.js         export function renderElderHelp(el, {me})
js/elder/circle.js       export function renderElderCircle(el, {me})
js/family/dashboard.js   export function renderFamily(el, {me, cid, tab})
js/family/overview.js    export function renderOverview(el, ctx)
js/family/medicines.js   export function renderMedicines(el, ctx)
js/family/appointments.js export function renderAppointments(el, ctx)
js/family/circle.js      export function renderCircleTab(el, ctx)
js/family/activity.js    export function renderActivity(el, ctx)
js/family/reports.js     export function renderReports(el, ctx)
js/family/printviews.js  export function renderEmergencyCard(el, {cid}); export function renderVisitSummary(el, {cid, aid})
```
`me` = response of `GET /auth/me`. Family `ctx = {cid, circle (GET /circles/:cid → circle), role, me, refresh()}`. `el` is an empty container the function fills; render functions are async-safe (they may be `async`).

**Shared helpers (Agent 1 provides, others import):** `api`, `h`, `toast`, `modal`, `confirmDialog`, `fmtTime`, `fmtDate`, `fmtDateTime`, `speak`, `MOODS`, `onLeave(fn)` (register a cleanup, e.g. clearInterval), `runCleanups()` (main.js calls it before every route render) from `../ui.js`/`../api.js`; `t`, `getLang`, `setLang` from `../i18n.js`.

**CSS classes available from app.css:** `.container .card .row .spread .grid .grid-2 .muted .center .btn .btn-primary .btn-ok .btn-danger .btn-ghost .btn-sm .badge .badge-ok .badge-warn .badge-danger .badge-info .badge-gray .hidden .sr-only .no-print`.
