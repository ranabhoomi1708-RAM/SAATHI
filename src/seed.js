const bcrypt = require('bcryptjs');
const db = require('./db');
const { addDays, localParts } = require('./lib/time');

function resetDatabase() {
  const tables = ['dose_logs','appointments','mood_checkins','activity_log','outbox','sos_events','notification_log','medications','members','circles','users'];
  db.exec('BEGIN;');
  tables.forEach(t => db.exec(`DELETE FROM ${t};`));
  db.exec('DELETE FROM sqlite_sequence;');
  db.exec('COMMIT;');
}

function seed() {
  resetDatabase();
  const pwHash = bcrypt.hashSync('Demo@1234', 10);
  const insertUser = db.prepare('INSERT INTO users(name,email,phone,password_hash) VALUES (?,?,?,?)');
  const rohanId = insertUser.run('Rohan Sharma','family@demo.com','9876500001',pwHash).lastInsertRowid;
  const priyaId = insertUser.run('Priya Verma','priya@demo.com','9876500002',pwHash).lastInsertRowid;
  const guptaId = insertUser.run('Mr. Gupta','neighbour@demo.com',null,pwHash).lastInsertRowid;

  const pinHash = bcrypt.hashSync('1234',10);
  const insertCircle = db.prepare(`INSERT INTO circles(elder_name,elder_age,elder_email,language,join_code,elder_pin_hash,blood_group,conditions,allergies,doctor_name,doctor_phone,emergency_notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const circleId = insertCircle.run(
    'Kamla Devi',72,null,'en','KAMLA726',pinHash,'B+','Type 2 diabetes, High blood pressure, Hypothyroidism','Penicillin','Dr. Anil Mehta','9876500099','Wears reading glasses. Prefers Hindi. Neighbour Mrs. Kapoor has a spare key.', rohanId
  ).lastInsertRowid;

  const insertMember = db.prepare('INSERT INTO members(circle_id,user_id,role,status,relation) VALUES (?,?,?,?,?)');
  insertMember.run(circleId, rohanId, 'admin', 'active', 'Son');
  insertMember.run(circleId, priyaId, 'editor', 'active', 'Daughter');
  insertMember.run(circleId, guptaId, 'viewer', 'pending', 'Neighbour');

  const insertMed = db.prepare(`INSERT INTO medications(circle_id,name,dosage,form,appearance,instructions,purpose,times,days_of_week,start_date,end_date,pills_left,pills_per_dose,refill_threshold,color,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','-10 days'))`);
  const medsData = [
    ['Thyronorm','50 mcg','tablet','small white round','empty_stomach','Thyroid','["06:30"]',40,'#7C3AED'],
    ['Pantoprazole','40 mg','tablet','small yellow oval','before_food','Acidity','["07:30"]',35,'#CA8A04'],
    ['Metformin','500 mg','tablet','white round, big','after_food','Sugar','["08:30","20:30"]',4,5,'#0F766E'],
    ['Telmisartan','40 mg','tablet','white oval','after_food','Blood pressure','["08:30"]',28,'#2563EB'],
    ['Ecosprin','75 mg','tablet','small pink round','after_food','Heart protection','["14:00"]',50,'#DB2777'],
    ['Atorvastatin','10 mg','tablet','white round','bedtime','Cholesterol','["21:30"]',30,'#EA580C']
  ];
  medsData.forEach(m => {
    const [name,dosage,form,appearance,instructions,purpose,times,pillsLeft,color] = m;
    insertMed.run(circleId, name, dosage, form, appearance, instructions, purpose, times, '[0,1,2,3,4,5,6]', null, null, pillsLeft, 1, 5, color, `Rohan Sharma (Son)`);
  });

  const today = localParts().date;
  const meds = db.prepare('SELECT id, name, times FROM medications WHERE circle_id=?').all(circleId);
  for (let i = 7; i >= 1; i--) {
    const dateStr = addDays(today, -i);
    meds.forEach(med => {
      const times = JSON.parse(med.times);
      times.forEach(time => {
        let status = 'taken';
        if (time >= '20:00' && i % 2 === 0) status = 'missed';
        if (med.name === 'Thyronorm' && i === 3) status = 'skipped';
        const stmt = db.prepare('INSERT INTO dose_logs(circle_id,medication_id,scheduled_date,scheduled_time,status,taken_at,logged_by) VALUES (?,?,?,?,?,?,?)');
        const takenAt = status === 'taken' ? `${dateStr}T${time}` : null;
        stmt.run(circleId, med.id, dateStr, time, status, takenAt, 'Kamla Devi (self)');
      });
    });
  }

  const moods = [4,4,3,4,3,2,2];
  const insertMood = db.prepare('INSERT INTO mood_checkins(circle_id,date,mood) VALUES (?,?,?)');
  for (let i = 7; i >= 1; i--) {
    const d = addDays(today, -i);
    const mood = moods[7 - i];
    insertMood.run(circleId, d, mood);
  }

  const insertAppt = db.prepare('INSERT INTO appointments(circle_id,doctor,specialty,location,datetime,purpose,questions,accompanied_by) VALUES (?,?,?,?,?,?,?,?)');
  const tomorrow = addDays(today, 1);
  insertAppt.run(circleId, 'Dr. Anil Mehta','Diabetologist','City Care Clinic, Sector 12', `${tomorrow} 11:00`,`Quarterly sugar review`,`["Is my Metformin dose still right?","Why do I feel dizzy in the morning?"]`, null);
  const day9 = addDays(today, 9);
  insertAppt.run(circleId, 'Dr. Sunita Rao','Cardiologist','Heart Institute, MG Road', `${day9} 16:30`,`BP and heart check`,`["My chest hurts"]`,`Rohan Sharma (Son)`);

  const insertAct = db.prepare('INSERT INTO activity_log(circle_id,actor,action,detail) VALUES (?,?,?,?)');
  insertAct.run(circleId, 'Rohan Sharma (Son)','circle_created','Created the circle for Kamla Devi');
  insertAct.run(circleId, 'Priya Verma (Daughter)','joined','Joined the circle as editor');
  insertAct.run(circleId, 'Rohan Sharma (Son)','medication_added','Metformin 500 mg');

  console.log('Seeded. Family login: family@demo.com / Demo@1234 · Elder login: code KAMLA726, PIN 1234');
}

seed();