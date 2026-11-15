// interactions.js – minimal implementation per contract

/** Disclaimer shown by UI */
const DISCLAIMER = 'Informational only. Please check with the doctor or pharmacist.';

/**
 * Simple alias map as required by the contract.
 * Keys are lower‑cased brand or generic names, values are the canonical generic.
 */
const ALIASES = {
  ecosprin: 'aspirin',
  disprin: 'aspirin',
  aspirin: 'aspirin',
  loprin: 'aspirin',
  warfarin: 'warfarin',
  acitrom: 'acenocoumarol',
  acenocoumarol: 'acenocoumarol',
  brufen: 'ibuprofen',
  ibuprofen: 'ibuprofen',
  combiflam: 'ibuprofen',
  voveran: 'diclofenac',
  diclofenac: 'diclofenac',
  naproxen: 'naproxen',
  dolo: 'paracetamol',
  crocin: 'paracetamol',
  calpol: 'paracetamol',
  paracetamol: 'paracetamol',
  telma: 'telmisartan',
  telmisartan: 'telmisartan'
};

/** Helper: resolve a name to its generic using ALIASES (case‑insensitive). */
function resolveGeneric(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return ALIASES[lower] || lower; // fallback to lower‑cased name itself
}

/**
 * Very simple safety‑check implementation.
 * Returns an array of warning objects. For this minimal version we only
 * provide a duplicate‑name warning when the new medication name matches an
 * existing one (case‑insensitive). All other warning kinds are omitted.
 */
function checkNewMedication(newName, existingNames) {
  const warnings = [];
  const newGeneric = resolveGeneric(newName);
  const seen = new Set();
  for (const existing of existingNames) {
    const gen = resolveGeneric(existing);
    if (gen === newGeneric && !seen.has(gen)) {
      warnings.push({
        severity: 'high',
        kind: 'duplicate',
        with: existing,
        message: `Medication "${newName}" duplicates existing "${existing}"`
      });
      seen.add(gen);
    }
  }
  return warnings;
}

module.exports = { DISCLAIMER, checkNewMedication };
