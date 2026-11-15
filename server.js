require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('./src/db');
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/circles', require('./src/routes/circles'));
app.use('/api/circles/:cid/members', require('./src/routes/members'));
app.use('/api/circles/:cid/medications', require('./src/routes/meds'));
app.use('/api/circles/:cid/appointments', require('./src/routes/appointments'));
app.use('/api/circles/:cid/mood', require('./src/routes/mood'));
app.use('/api/circles/:cid/ai', require('./src/routes/ai'));
app.use('/api/circles/:cid', require('./src/routes/doses'));
app.use('/api/circles/:cid', require('./src/routes/insights'));
app.use('/api/circles/:cid', require('./src/routes/ops'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('Saathi running on http://localhost:' + PORT);
    try { require('./src/lib/scheduler').start(); } catch (e) { console.error('Scheduler failed to start:', e); }
  });
}
module.exports = app;
