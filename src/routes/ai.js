// ai.js – AI prescription scanning route per contract

const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireCircle } = require('../lib/auth');
const { generateJson, enabled } = require('../lib/gemini');

const router = express.Router({ mergeParams: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

const DISCLAIMER = 'AI-read prescriptions can contain mistakes. Please check every field against the paper prescription before saving.';

router.post('/scan-prescription', requireCircle('edit'), upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a JPG, PNG or WEBP photo' });
  }
  const mime = req.file.mimetype;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    return res.status(400).json({ error: 'Please upload a JPG, PNG or WEBP photo' });
  }
  if (!enabled()) {
    return res.json({ medications: [], source: 'unavailable', disclaimer: DISCLAIMER });
  }
  const image = { mimeType: mime, base64: req.file.buffer.toString('base64') };
  const prompt = `You read prescriptions for an elderly care app in India. Extract every medicine from this image. Return ONLY JSON: {"medications":[{"name":"","dosage":"","form":"tablet|capsule|syrup|injection|drops|inhaler|other","instructions":"with_food|before_food|after_food|empty_stomach|bedtime|anytime","times":["HH:MM"],"purpose":""}]}. Convert frequencies to clock times using these defaults: once daily (OD) 08:00, twice daily (BD) 08:00 and 20:00, three times daily (TDS) 08:00, 14:00, 20:00, at night (HS) 21:00, 1-0-1 means 08:00 and 20:00, 1-1-1 means 08:00, 14:00, 20:00, 0-0-1 means 21:00. If something is unreadable use an empty string. Never invent medicines.`;
  const result = await generateJson(prompt, image);
  if (!result || !Array.isArray(result.medications)) {
    return res.json({ medications: [], source: 'unavailable', disclaimer: DISCLAIMER });
  }
  // sanitize
  const meds = result.medications.slice(0, 12).map(m => {
    const form = ['tablet','capsule','syrup','injection','drops','inhaler','other'].includes(m.form) ? m.form : 'tablet';
    const instr = ['with_food','before_food','after_food','empty_stomach','bedtime','anytime'].includes(m.instructions) ? m.instructions : 'anytime';
    let times = Array.isArray(m.times) ? m.times.filter(t => /^\d{2}:\d{2}$/.test(t)) : [];
    if (!times.length) times = ['08:00'];
    return {
      name: typeof m.name === 'string' ? m.name.trim().slice(0,80) : '',
      dosage: typeof m.dosage === 'string' ? m.dosage.trim().slice(0,80) : '',
      form,
      instructions: instr,
      times,
      purpose: typeof m.purpose === 'string' ? m.purpose.trim().slice(0,80) : ''
    };
  });
  res.json({ medications: meds, source: 'gemini', disclaimer: DISCLAIMER });
});

module.exports = router;
