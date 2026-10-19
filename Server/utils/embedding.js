const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const MAX_TEXT_LENGTH = 3000;

let embeddingPipelinePromise;

async function getEmbeddingPipeline() {
  if (!embeddingPipelinePromise) {
    embeddingPipelinePromise = import('@xenova/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', DEFAULT_MODEL)
    );
  }
  return embeddingPipelinePromise;
}

function safeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function pickValue(source, keys) {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function flattenRecordData(data) {
  if (!data || typeof data !== 'object') return '';
  const parts = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue;
    const normalized = Array.isArray(value) ? value.join(', ') : String(value);
    if (!normalized.trim()) continue;
    parts.push(`${key}: ${normalized}`);
  }
  return parts.join(' | ');
}

function normalizeText(value, fallback = 'Not documented') {
  const text = String(value || '').trim();
  return text ? text : fallback;
}

function resolvePatientName(patient) {
  if (!patient) return '';
  const full = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim();
  return (patient.name || full || '').trim();
}

function formatAdmissionDate(record) {
  const data = record?.data || {};
  const candidate = pickValue(data, [
    'admissionDate',
    'admission_date',
    'admittedAt',
    'admitted_at',
    'visitDate',
    'visit_date',
    'date',
  ]);
  if (candidate) return candidate;
  if (record?.createdAt) return new Date(record.createdAt).toISOString();
  return 'Not documented';
}

function extractNotes(record) {
  const data = record?.data || {};
  return pickValue(data, [
    'notes',
    'note',
    'doctorNotes',
    'doctor_notes',
    'remarks',
    'summary',
    'diagnosis',
    'complaint',
    'assessment',
  ]);
}

export function buildRecordEmbeddingText({ patient, record, formName, hospitalName }) {
  const conditions = safeArray(patient?.conditions);
  const medications = safeArray(patient?.medications);
  const admissionDate = formatAdmissionDate(record);
  const notes = extractNotes(record);
  const flatData = flattenRecordData(record?.data || {});
  const patientName = resolvePatientName(patient);
  const patientEmail = (patient?.email || patient?.username || '').trim();
  const patientId = (patient?.patientId || patient?._id || '').toString();

  const textToEmbed = [
    `Patient Name: ${normalizeText(patientName, 'Unknown')}`,
    `Patient ID: ${normalizeText(patientId, 'Unknown')}`,
    `Patient Email: ${normalizeText(patientEmail, 'Unknown')}`,
    `Age: ${normalizeText(patient?.age, 'Unknown')}`,
    `Gender: ${normalizeText(patient?.gender, 'Unknown')}`,
    `Conditions: ${normalizeText(conditions.join(', '))}`,
    `Medications: ${normalizeText(medications.join(', '))}`,
    `Admission Date: ${normalizeText(admissionDate)}`,
    `Notes: ${normalizeText(notes)}`,
    `Hospital: ${normalizeText(hospitalName)}`,
    `Form: ${normalizeText(formName)}`,
    flatData ? `Record Data: ${flatData}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return textToEmbed.length > MAX_TEXT_LENGTH ? textToEmbed.slice(0, MAX_TEXT_LENGTH) : textToEmbed;
}

export function buildRecordEmbeddingPayload({ patient, record, formName, hospitalName }) {
  const conditions = safeArray(patient?.conditions);
  const medications = safeArray(patient?.medications);
  const admissionDate = formatAdmissionDate(record);
  const notes = extractNotes(record);
  const patientName = resolvePatientName(patient);
  const patientEmail = (patient?.email || patient?.username || '').trim();
  const text = buildRecordEmbeddingText({ patient, record, formName, hospitalName });

  return {
    text,
    admissionDate,
    notes: normalizeText(notes),
    patientName: patientName ? patientName.trim() : '',
    patientEmail,
    patientAge: patient?.age ?? null,
    patientGender: patient?.gender || '',
    patientConditions: conditions,
    patientMedications: medications,
  };
}

export async function generateEmbedding(text) {
  const pipeline = await getEmbeddingPipeline();
  const output = await pipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
