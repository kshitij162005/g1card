// Shared parsing/formatting for body measurements, used by the edit dialog and every read-only view
// so a patient's blood group, height and BMI always look the same wherever they appear.

/** Normalise free-typed values like "b+ve", "O neg", "AB positive" to the canonical labels */
export function normaliseBloodGroup(raw?: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const m = value.replace(/\s+/g, ' ').match(/^(AB|A|B|O)\s*(\+|-|−|pos(itive)?|neg(ative)?|\+ve|-ve)$/i)
    || value.replace(/\s+/g, '').match(/^(AB|A|B|O)(\+ve|-ve|\+|-|−|positive|negative|pos|neg)$/i);
  if (m) {
    const sign = /^(\+|pos|\+ve)/i.test(m[2]) ? '+' : '−';
    return `${m[1].toUpperCase()}${sign}`;
  }
  return value;
}

export function parseHeightToCm(raw?: string | number): number | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const ftIn = value.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(\d+(?:\.\d+)?)?\s*(?:"|''|in|inch(?:es)?)?$/i);
  if (ftIn) return Math.round((Number(ftIn[1]) * 12 + Number(ftIn[2] || 0)) * 2.54);
  const cm = value.match(/^(\d+(?:\.\d+)?)\s*(?:cm)?$/i);
  if (cm) {
    const n = Number(cm[1]);
    return n > 3 ? Math.round(n) : Math.round(n * 100); // "1.75" metres
  }
  return null;
}

export function cmToFeetInches(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

/** "175 cm" or "5′9″" as the patient entered it, plus the other unit as a hint */
export function formatHeight(raw?: string | number) {
  const cm = parseHeightToCm(raw);
  if (!cm) return { main: raw ? String(raw) : '', hint: '' };
  const { ft, inch } = cmToFeetInches(cm);
  const imperial = `${ft}′${inch}″`;
  const looksImperial = /'|ft|feet/i.test(String(raw));
  return looksImperial ? { main: imperial, hint: `${cm} cm` } : { main: `${cm} cm`, hint: imperial };
}

export function computeBmi(height?: string | number, weightKg?: string | number): number | null {
  const cm = parseHeightToCm(height);
  const kg = Number(weightKg);
  if (!cm || !kg) return null;
  return Math.round((kg / Math.pow(cm / 100, 2)) * 10) / 10;
}

export function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', tone: 'var(--app-warning)' };
  if (bmi < 25) return { label: 'Healthy range', tone: 'var(--app-success-text)' };
  if (bmi < 30) return { label: 'Overweight', tone: 'var(--app-warning)' };
  return { label: 'Obese range', tone: 'var(--app-danger)' };
}
