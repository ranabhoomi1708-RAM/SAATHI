const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
async function call(parts, json) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.3 } };
    if (json) body.generationConfig.responseMimeType = 'application/json';
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal
    });
    clearTimeout(to);
    if (!res.ok) { console.error('Gemini HTTP', res.status); return null; }
    const data = await res.json();
    const parts2 = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    return parts2 ? parts2.map(p => p.text || '').join('') : null;
  } catch (e) { console.error('Gemini failed:', e.message); return null; }
}
async function generateText(prompt) { return call([{ text: prompt }], false); }
async function generateJson(prompt, image) {
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  const txt = await call(parts, true);
  if (!txt) return null;
  try { return JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch (e) { return null; }
}
module.exports = { generateText, generateJson, enabled: () => !!process.env.GEMINI_API_KEY };