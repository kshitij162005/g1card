// Golu: read-only question answering for super admins.
//
// Flow per question:
//   1. plan    – the model sees the schema + recent conversation, rewrites the question so it
//                stands alone, and returns read-only MongoDB queries (or asks for semantic search).
//   2. execute – queries are validated (collection/operator/stage allowlists), run with time and
//                size limits, and sensitive fields are stripped from the results.
//   3. answer  – the model answers ONLY from the results and cites the exact documents as evidence.
//
// Golu never writes to the database and never performs actions.

import mongoose from 'mongoose';
import { callModel } from './aiClient.js';
import { generateEmbedding } from './embedding.js';

const HISTORY_TURNS = 12;
const HISTORY_CHARS_PER_MESSAGE = 1200;
const MAX_QUERIES = 3;
const MAX_FIND_LIMIT = 100;
const QUERY_TIMEOUT_MS = 8000;
const RESULT_CHARS = 14000;

const SENSITIVE_KEY = /(password|salt|otp|token|secret|^code$|userAgent|ipAddress)/i;

// Collections Golu may read, with notes that help the planner pick the right fields.
const COLLECTIONS = {
  patients: {
    model: 'Patient',
    file: 'Patient.js',
    notes: 'One document per registered patient. createdAt = date the patient registered on G1Card. Display name is `name`, or firstName + lastName. conditions/allergies/medications/surgeries are arrays of strings. hospitalLinks/hospitals/hospital link the patient to hospitals.',
  },
  hospitals: {
    model: 'Hospital',
    file: 'Hospital.js',
    notes: 'One document per hospital. createdAt = registration date. status: pending|approved|rejected|suspended.',
  },
  records: {
    model: 'Record',
    file: 'Record.js',
    notes: 'Medical records submitted by hospitals. `data` is free-form form answers (diagnosis, notes, vitals...). createdAt = date the record was created. patient -> patients, hospital -> hospitals, form -> formtemplates.',
  },
  hospitalaccesses: {
    model: 'HospitalAccess',
    file: 'HospitalAccess.js',
    notes: 'Consent between a hospital and a patient. status: PENDING|APPROVED|DENIED|REVOKED. accessLevel: GENERAL|COMPLETE.',
  },
  staffs: { model: 'Staff', file: 'Staff.js', notes: 'Hospital staff members.' },
  formtemplates: { model: 'FormTemplate', file: 'FormTemplate.js', notes: 'Medical record form templates created by hospitals.' },
  auditlogs: { model: 'AuditLog', file: 'AuditLog.js', notes: 'Security/compliance events (logins, PHI access, record changes).' },
  deletionrequests: { model: 'DeletionRequest', file: 'DeletionRequest.js', notes: 'Patient data/account deletion requests.' },
  notifications: { model: 'Notification', file: 'Notification.js', notes: 'Notifications sent to patients, hospitals and admins.' },
  hospitalupdaterequests: { model: 'HospitalUpdateRequest', file: 'HospitalUpdateRequest.js', notes: 'Hospital profile change requests reviewed by admins.' },
};

const ALLOWED_STAGES = new Set(['$match', '$group', '$project', '$sort', '$limit', '$skip', '$count', '$unwind', '$lookup', '$addFields', '$set', '$sortByCount']);
const FORBIDDEN_OPERATORS = new Set(['$where', '$function', '$accumulator', '$out', '$merge', '$jsonSchema']);

/* ------------------------------------------------------------------------- */
/* Schema description (generated from the Mongoose models)                   */
/* ------------------------------------------------------------------------- */

const modelCache = new Map();

async function getModel(collection) {
  const entry = COLLECTIONS[collection];
  if (!entry) return null;
  if (!modelCache.has(collection)) {
    modelCache.set(collection, (await import(`../models/${entry.file}`)).default);
  }
  return modelCache.get(collection);
}

let schemaDocPromise = null;

function describeSchema() {
  if (!schemaDocPromise) {
    schemaDocPromise = (async () => {
      const refToCollection = Object.fromEntries(Object.entries(COLLECTIONS).map(([name, c]) => [c.model, name]));
      const lines = [];
      for (const [collection, entry] of Object.entries(COLLECTIONS)) {
        const model = await getModel(collection);
        const fields = [];
        model.schema.eachPath((path, type) => {
          if (path === '__v' || SENSITIVE_KEY.test(path)) return;
          let desc = `${path}:${type.instance || 'Mixed'}`;
          const ref = type.options?.ref;
          if (ref) desc += `->${refToCollection[ref] || ref}`;
          const values = (type.options?.enum || []).filter(Boolean);
          if (values.length) desc += `(${values.join('|')})`;
          fields.push(desc);
        });
        lines.push(`- ${collection}: ${entry.notes}\n  fields: ${fields.join(', ')}`);
      }
      return lines.join('\n');
    })();
  }
  return schemaDocPromise;
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// Earlier turns, with the exact documents each answer referred to, so follow-ups like
// "which hospital is he linked to?" can be resolved to an _id instead of a fuzzy name search.
function formatHistory(messages, { withRefs = false } = {}) {
  return (messages || [])
    .slice(-HISTORY_TURNS)
    .map(m => {
      const content = String(m.content || '');
      let clipped = content.length > HISTORY_CHARS_PER_MESSAGE ? `${content.slice(0, HISTORY_CHARS_PER_MESSAGE)}…` : content;
      const refs = (m.sources || []).flatMap(src => (src?.refs || []).map(ref => `${src.collection} _id ${ref._id} (${ref.name})`));
      if (withRefs && m.role === 'assistant' && refs.length) clipped += `\n[Documents referenced in this answer: ${refs.join('; ')}]`;
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: clipped };
    });
}

function collectRefs(result) {
  const docs = result?.documents || result?.rows || (Array.isArray(result) ? result : []);
  return docs
    .filter(d => d && typeof d._id === 'string' && OBJECT_ID.test(d._id))
    .slice(0, 10)
    .map(d => ({ _id: d._id, name: d.displayName || d.name || d.patientName || d.title || d.formName || d.hospital?.name || d.patient?.name || 'document' }));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

// Validate the planner's query. With convert=true, JSON values become BSON types: aggregation
// pipelines are not cast by Mongoose, so dates/ids must be converted there. find/count/distinct
// are cast by Mongoose using the schema, which also keeps string fields like `dob` intact.
function prepare(value, convert = false, path = '') {
  if (Array.isArray(value)) return value.map(v => prepare(v, convert, path));
  if (value && typeof value === 'object') {
    if (typeof value.$date === 'string') return new Date(value.$date);
    if (typeof value.$oid === 'string' && OBJECT_ID.test(value.$oid)) return new mongoose.Types.ObjectId(value.$oid);
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (FORBIDDEN_OPERATORS.has(key)) throw new Error(`Operator ${key} is not allowed`);
      if (SENSITIVE_KEY.test(key)) throw new Error('Sensitive fields cannot be queried');
      out[key] = prepare(val, convert, key);
    }
    return out;
  }
  if (convert && typeof value === 'string') {
    if (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))) return new Date(value);
    if (OBJECT_ID.test(value) && !/regex/i.test(path)) return new mongoose.Types.ObjectId(value);
  }
  return value;
}

function stripSensitive(value) {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value && typeof value === 'object') {
    if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return String(value);
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key) || key === '__v') continue;
      if (key === 'attachments' && Array.isArray(val)) {
        out[key] = val.map(a => ({ name: a?.name, type: a?.type || a?.mimeType }));
        continue;
      }
      out[key] = stripSensitive(val);
    }
    return out;
  }
  return value;
}

function displayName(doc) {
  return doc?.name || [doc?.firstName, doc?.lastName].filter(Boolean).join(' ') || doc?.patientId || doc?.username || 'Unknown';
}

// Replace patient/hospital/form ids in find() results with { _id, name } so answers can cite names.
async function attachNames(docs) {
  const isId = id => id && OBJECT_ID.test(String(id));
  const getters = {
    patients: [d => d.patient],
    hospitals: [d => d.hospital, d => d.hospitals, d => (d.hospitalLinks || []).map(l => l?.hospital)],
    formtemplates: [d => d.form],
  };
  const lookups = {};
  for (const [collection, fns] of Object.entries(getters)) {
    const ids = new Set();
    for (const doc of docs) for (const fn of fns) [].concat(fn(doc) || []).filter(isId).forEach(id => ids.add(String(id)));
    if (!ids.size) continue;
    const model = await getModel(collection);
    const rows = await model.find({ _id: { $in: [...ids] } }).select('name firstName lastName patientId').lean();
    lookups[collection] = new Map(rows.map(r => [String(r._id), { _id: String(r._id), name: displayName(r) }]));
  }
  const resolve = (collection, id) => (isId(id) && lookups[collection]?.get(String(id))) || id;
  for (const doc of docs) {
    if (doc.firstName || doc.lastName || doc.name) doc.displayName = displayName(doc);
    if (doc.patient) doc.patient = resolve('patients', doc.patient);
    if (doc.form) doc.form = resolve('formtemplates', doc.form);
    if (doc.hospital) doc.hospital = resolve('hospitals', doc.hospital);
    if (Array.isArray(doc.hospitals)) doc.hospitals = doc.hospitals.map(id => resolve('hospitals', id));
    if (Array.isArray(doc.hospitalLinks)) doc.hospitalLinks = doc.hospitalLinks.map(l => ({ ...l, hospital: resolve('hospitals', l?.hospital) }));
    // Patients store hospital links in three legacy fields; replace them with one de-duplicated list
    if (doc.patientId !== undefined || doc.hospitalLinks || doc.hospitals) {
      const linkedAt = new Map((doc.hospitalLinks || []).filter(l => l?.hospital?._id).map(l => [l.hospital._id, l.linkedAt]));
      const linked = [doc.hospital, ...(doc.hospitals || []), ...(doc.hospitalLinks || []).map(l => l?.hospital)].filter(h => h?._id);
      if (linked.length) {
        doc.linkedHospitals = [...new Map(linked.map(h => [h._id, { ...h, ...(linkedAt.get(h._id) ? { linkedAt: linkedAt.get(h._id) } : {}) }])).values()];
        delete doc.hospital;
        delete doc.hospitals;
        delete doc.hospitalLinks;
      }
    }
  }
  return docs;
}

// Aggregation rows carry raw ids (e.g. a hospital id from $group, possibly renamed to hospitalId);
// attach the matching names so the answer can use them.
async function nameGroupIds(rows) {
  const isId = v => typeof v === 'string' && OBJECT_ID.test(v);
  const ids = [...new Set(rows.flatMap(r => Object.values(r || {}).filter(isId)))];
  if (!ids.length) return rows;
  const names = new Map();
  for (const collection of ['hospitals', 'patients', 'formtemplates', 'staffs']) {
    const model = await getModel(collection);
    const found = await model.find({ _id: { $in: ids } }).select('name firstName lastName patientId').lean();
    found.forEach(doc => names.set(String(doc._id), displayName(doc)));
  }
  return rows.map(row => {
    const out = { ...row };
    for (const [key, value] of Object.entries(row || {})) {
      if (!isId(value) || !names.has(value)) continue;
      if (key === '_id') out.name = out.name || names.get(value);
      else if (/name$/i.test(key)) out[key] = names.get(value);
      else out[`${key.replace(/Id$/, '')}Name`] = out[`${key.replace(/Id$/, '')}Name`] || names.get(value);
    }
    return out;
  });
}

/* ------------------------------------------------------------------------- */
/* 1. Plan                                                                    */
/* ------------------------------------------------------------------------- */

// Every answer cites evidence, so phrases asking for proof carry no filtering meaning. Small models
// tend to turn "valid proof" into filters like emailVerified=true, so remove them before planning.
const PROOF_PHRASE = /[,\s]*(?:\b(?:with|along with|and|plus|give|show|provide|including|me)\b\s+){0,3}(?:\b(?:a|an|the|some)\b\s+)?(?:\b(?:valid|proper|solid|clear|strong|verifiable)\b\s+)?\b(?:proofs?|evidences?)\b/gi;

function stripProofRequest(question) {
  const stripped = question.replace(PROOF_PHRASE, ' ').replace(/\s{2,}/g, ' ').trim();
  return stripped.length >= 3 ? stripped : question;
}

async function plan({ question, history, previousError, prefer }) {
  const schema = await describeSchema();
  const system = [
    'You plan READ-ONLY MongoDB queries for "Golu", the G1Card health-records assistant for super admins.',
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
    '',
    'Database collections:',
    schema,
    '',
    'Return ONLY a JSON object:',
    '{',
    '  "standaloneQuestion": string,   // the question rewritten so it makes sense without the chat history (resolve "he", "that hospital", "them", etc.)',
    '  "mode": "database" | "semantic_search" | "conversation",',
    '  "queries": [ { "purpose": string, "collection": string, "operation": "find"|"count"|"distinct"|"aggregate",',
    '                 "filter": object, "projection": object, "sort": object, "limit": number,',
    '                 "distinctField": string, "pipeline": array } ]',
    '}',
    '',
    'Rules:',
    '- mode "database" for anything answerable from structured fields: counts, firsts/lasts, rankings, lists, dates, statuses, names, trends. This is the default.',
    '- mode "semantic_search" only for questions about free-text clinical content inside records (symptoms, notes, diagnoses described in prose).',
    '- mode "conversation" (with empty queries) for greetings, thanks, or questions answerable from the conversation alone.',
    `- Use at most ${MAX_QUERIES} queries. Prefer one precise query.`,
    '- "first"/"earliest" = sort createdAt ascending; "latest"/"recent" = sort createdAt descending.',
    '- Only filter on conditions the user actually stated. Words like "proof", "evidence", "valid", "details" or "verify" mean the answer must cite evidence; they are NOT filters (do not filter on emailVerified, status, etc. unless asked).',
    '- A patient\'s hospitals are in patients.hospital, patients.hospitals and patients.hospitalLinks.hospital; consented hospitals are in hospitalaccesses (status APPROVED). Hospital names are filled in automatically for these id fields. When asked which hospitals a patient is linked to, project all three fields (hospital, hospitals, hospitalLinks).',
    '- When the question refers to someone or something from earlier ("he", "that hospital", "those patients"), take the _id from the [Documents referenced …] notes and filter by it, e.g. {"_id": "69116f58f174b041e0cbf23c"}. Never search by name when an _id is available. _id is the 24-character database id; patientId is a different human-readable code like "P1771843734622".',
    '- Always include identifying fields (_id, name/firstName/lastName/patientId, createdAt) in projections so the answer can cite evidence.',
    '- Dates: use ISO strings like "2026-01-31T00:00:00Z" (they are converted to dates). Ids: 24-char hex strings.',
    '- Text matching: {"$regex": "diabetes", "$options": "i"}. Arrays of strings can be matched with the same regex.',
    '- Ids in results (including $group _id values) are automatically resolved to names, so do NOT use $lookup just to get names. Keep pipelines short. In $project never mix 0 and 1 (except _id).',
    '- Aggregate stages allowed: $match, $group, $project, $sort, $limit, $skip, $count, $unwind, $lookup, $addFields, $sortByCount. $lookup "from" must be one of the collections above.',
    '- Never query password, salt, otp, token or secret fields. Never write data.',
    '- patients.suspended = true marks accounts suspended by an admin. Suspended patients are excluded automatically; only filter on suspended when the user asks about suspended patients.',
    '',
    'Examples:',
    'Q: "who was the first patient on G1card, with valid proof" ->',
    '{"standaloneQuestion":"Who was the first patient registered on G1Card? Include evidence.","mode":"database","queries":[{"purpose":"Earliest registered patient","collection":"patients","operation":"find","filter":{},"projection":{"name":1,"firstName":1,"lastName":1,"patientId":1,"email":1,"createdAt":1},"sort":{"createdAt":1},"limit":1}]}',
    'Q: "which hospital has the most medical records" ->',
    '{"standaloneQuestion":"Which hospital has the most medical records?","mode":"database","queries":[{"purpose":"Medical records per hospital","collection":"records","operation":"aggregate","pipeline":[{"$group":{"_id":"$hospital","records":{"$sum":1},"latestRecord":{"$max":"$createdAt"}}},{"$sort":{"records":-1}},{"$limit":10}]}]}',
    'Q: "how many patients have diabetes" ->',
    '{"standaloneQuestion":"How many patients have diabetes?","mode":"database","queries":[{"purpose":"Patients with diabetes","collection":"patients","operation":"count","filter":{"conditions":{"$regex":"diabetes","$options":"i"}}}]}',
    previousError ? `- Your previous plan failed with: ${previousError}. Fix it.` : '',
  ].filter(line => line !== '').join('\n');

  const { content: raw } = await callModel({
    role: 'admin',
    prefer,
    messages: [
      { role: 'system', content: system },
      ...formatHistory(history, { withRefs: true }),
      { role: 'user', content: stripProofRequest(question) },
    ],
    temperature: 0,
    maxTokens: 900,
    jsonMode: true,
  });
  const parsed = extractJson(raw);
  if (!parsed) throw new Error('Planner returned invalid JSON');
  return {
    standaloneQuestion: String(parsed.standaloneQuestion || question),
    mode: ['database', 'semantic_search', 'conversation'].includes(parsed.mode) ? parsed.mode : 'database',
    queries: Array.isArray(parsed.queries) ? parsed.queries.slice(0, MAX_QUERIES) : [],
  };
}

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nameConditions(value) {
  const conditions = [{ name: value }, { firstName: value }, { lastName: value }];
  const text = typeof value === 'string' ? value : typeof value?.$regex === 'string' ? value.$regex : '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    conditions.push({
      firstName: { $regex: `^${escapeRegex(words[0])}`, $options: 'i' },
      lastName: { $regex: `^${escapeRegex(words.slice(1).join(' '))}`, $options: 'i' },
    });
  }
  if (typeof value === 'string') {
    conditions.push({ name: { $regex: `^${escapeRegex(value.trim())}$`, $options: 'i' } });
  }
  return conditions;
}

/* ------------------------------------------------------------------------- */
/* 2. Execute                                                                 */
/* ------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------- */
/* Suspended patients                                                         */
/* ------------------------------------------------------------------------- */
// Suspended patients are left out of answers unless the admin asks about suspension or names a
// specific patient. Collections linked to a patient drop that patient's documents too.
const PATIENT_LINKED = new Set(['records', 'hospitalaccesses', 'deletionrequests']);
const PATIENT_IDENTIFYING = /^(_id|name|firstName|lastName|email|username|patientId|phone)$/;

function mentionsSuspension(text) {
  return /suspen/i.test(String(text || ''));
}

function filterNamesPatient(filter, keyRegex) {
  // True when the filter pins down specific documents by an identifying field (anywhere in $and/$or)
  if (!filter || typeof filter !== 'object') return false;
  return Object.entries(filter).some(([key, value]) => {
    if (key === '$and' || key === '$or') return Array.isArray(value) && value.some(v => filterNamesPatient(v, keyRegex));
    return keyRegex.test(key);
  });
}

async function createSuspensionPolicy(question, standaloneQuestion) {
  const Patient = await getModel('patients');
  const suspendedIds = await Patient.find({ suspended: true }).distinct('_id');
  return {
    includeAll: mentionsSuspension(question) || mentionsSuspension(standaloneQuestion),
    suspendedIds,
    excluded: 0,
  };
}

async function applySuspensionPolicy(policy, collection, filter, operation) {
  if (!policy || policy.includeAll || !policy.suspendedIds.length) return { filter, match: null };
  if (collection === 'patients') {
    if (filterNamesPatient(filter, PATIENT_IDENTIFYING)) return { filter, match: null };
    const extra = { suspended: { $ne: true } };
    return { filter: { $and: [filter, extra] }, match: extra, counted: true };
  }
  if (PATIENT_LINKED.has(collection)) {
    if (filterNamesPatient(filter, /^patient$/)) return { filter, match: null };
    const extra = { patient: { $nin: policy.suspendedIds } };
    return { filter: { $and: [filter, extra] }, match: extra, counted: true };
  }
  return { filter, match: null };
}

async function runQuery(query, policy = null) {
  const collection = String(query.collection || '').toLowerCase();
  const model = await getModel(collection);
  if (!model) throw new Error(`Unknown collection "${query.collection}"`);

  const operation = String(query.operation || 'find').toLowerCase();
  const filter = prepare(query.filter || {});
  // Person names live in `name` or in firstName + lastName; match a name filter against all of them
  if (['patients', 'staffs'].includes(collection) && filter.name !== undefined) {
    filter.$and = [...(filter.$and || []), { $or: nameConditions(filter.name) }];
    delete filter.name;
  }
  // Models often put a document _id into human-readable code fields (patientId "P177…", staffId)
  for (const codeField of ['patientId', 'staffId']) {
    if (typeof filter[codeField] === 'string' && OBJECT_ID.test(filter[codeField]) && !filter._id) {
      filter._id = filter[codeField];
      delete filter[codeField];
    }
  }
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), MAX_FIND_LIMIT);
  const original = filter;
  const scoped = await applySuspensionPolicy(policy, collection, original, operation);
  if (scoped.counted && operation !== 'aggregate') {
    // Remember how many suspended patients were left out, so the answer can say so
    const all = await model.countDocuments(original).maxTimeMS(QUERY_TIMEOUT_MS);
    const kept = await model.countDocuments(scoped.filter).maxTimeMS(QUERY_TIMEOUT_MS);
    policy.excluded += Math.max(0, all - kept);
  }
  const effective = scoped.filter;

  if (operation === 'count') {
    return { count: await model.countDocuments(effective).maxTimeMS(QUERY_TIMEOUT_MS) };
  }

  if (operation === 'distinct') {
    const field = String(query.distinctField || '');
    if (!field || SENSITIVE_KEY.test(field)) throw new Error('Invalid distinct field');
    const values = await model.distinct(field, effective).maxTimeMS(QUERY_TIMEOUT_MS);
    return { values: values.slice(0, 500), total: values.length };
  }

  if (operation === 'aggregate') {
    const pipeline = prepare(Array.isArray(query.pipeline) ? query.pipeline : [], true);
    for (const stage of pipeline) {
      const name = Object.keys(stage || {})[0];
      if (!ALLOWED_STAGES.has(name)) throw new Error(`Stage ${name} is not allowed`);
      if (name === '$lookup' && !COLLECTIONS[String(stage.$lookup?.from)]) throw new Error('Invalid $lookup collection');
    }
    if (!pipeline.some(stage => '$limit' in stage || '$count' in stage)) pipeline.push({ $limit: MAX_FIND_LIMIT });
    // Suspended patients are left out unless asked for (only when the pipeline doesn't target a patient itself)
    const firstMatch = pipeline.find(stage => '$match' in stage)?.$match || {};
    const pipelineScope = await applySuspensionPolicy(policy, collection, firstMatch, 'aggregate');
    if (pipelineScope.match) {
      pipeline.unshift({ $match: pipelineScope.match });
      if (policy) policy.excluded += collection === 'patients' ? policy.suspendedIds.length : 1;
    }
    const rows = stripSensitive(await model.aggregate(pipeline).option({ maxTimeMS: QUERY_TIMEOUT_MS }));
    return { rows: await nameGroupIds(rows) };
  }

  if (operation === 'find') {
    const projection = prepare(query.projection || {});
    const isInclusion = Object.values(projection).some(v => v === 1 || v === true);
    if (isInclusion && ['patients', 'staffs'].includes(collection)) {
      for (const f of ['name', 'firstName', 'lastName', 'createdAt']) projection[f] = 1;
    } else if (isInclusion) {
      for (const f of ['name', 'createdAt']) projection[f] = 1;
    }
    const HOSPITAL_FIELDS = ['hospital', 'hospitals', 'hospitalLinks'];
    if (collection === 'patients' && HOSPITAL_FIELDS.some(f => projection[f] || projection[`${f}.hospital`])) {
      for (const f of HOSPITAL_FIELDS) projection[f] = 1;
      delete projection['hospitalLinks.hospital'];
    }
    if (collection === 'patients' && isInclusion) projection.suspended = 1;
    const docs = await model.find(effective)
      .select(projection)
      .sort(prepare(query.sort || { createdAt: -1 }))
      .limit(limit)
      .maxTimeMS(QUERY_TIMEOUT_MS)
      .lean();
    const total = await model.countDocuments(effective).maxTimeMS(QUERY_TIMEOUT_MS);
    return { total, returned: docs.length, documents: stripSensitive(await attachNames(docs)) };
  }

  throw new Error(`Unsupported operation "${operation}"`);
}

async function semanticSearch(question, policy = null) {
  const RecordEmbedding = (await import('../models/RecordEmbedding.js')).default;
  const queryVector = await generateEmbedding(question);
  const hits = await RecordEmbedding.aggregate([
    { $vectorSearch: { index: 'record_embeddings', path: 'embedding', queryVector, numCandidates: 200, limit: 10 } },
    { $project: { score: { $meta: 'vectorSearchScore' }, recordId: 1, patientId: 1, patientName: 1, hospitalName: 1, formName: 1, admissionDate: 1, text: 1, createdAt: 1 } },
  ]);
  const hidden = new Set((policy && !policy.includeAll ? policy.suspendedIds : []).map(String));
  const kept = hits.filter(hit => !hidden.has(String(hit.patientId)));
  if (policy) policy.excluded += hits.length - kept.length;
  return kept.map(hit => stripSensitive(hit));
}

/* ------------------------------------------------------------------------- */
/* 3. Answer                                                                  */
/* ------------------------------------------------------------------------- */

async function compose({ question, history, standaloneQuestion, evidence, mode, prefer }) {
  const system = [
    'You are Golu, the G1Card health intelligence assistant for super admins.',
    'You are read-only: you answer questions, you never perform actions or change data. If asked to do something, explain that you can only answer questions.',
    'Answer ONLY from the query results provided. Never invent patients, hospitals, numbers or dates.',
    'If the results are empty or do not answer the question, say so plainly and suggest how to rephrase.',
    'Write concise Markdown: lead with the direct answer in the first sentence, then supporting detail. Use a table when listing several items.',
    'Format dates like "12 Mar 2026". Do not mention MongoDB, queries, JSON or collections by name.',
    'Any number you state must match the results exactly: if you say "N hospitals", list exactly N. Distinguish direct links from consented access when both appear.',
    'Do not write an evidence or sources section and do not quote database ids; a verified evidence list is appended automatically.',
    'For a patient\'s hospitals, use the linkedHospitals list (it already combines every hospital field).',
    'Avoid clinical advice; focus on operational insight.',
    'If a patient in the results has suspended: true, say clearly that their account is suspended.',
  ].filter(Boolean).join(' ');

  const resultsBlock = mode === 'conversation'
    ? ''
    : `\n\nQuery results:\n${JSON.stringify(evidence).slice(0, RESULT_CHARS)}`;

  return callModel({
    role: 'admin',
    prefer,
    messages: [
      { role: 'system', content: system },
      ...formatHistory(history),
      { role: 'user', content: `${question}${standaloneQuestion && standaloneQuestion !== question ? `\n\n(Interpreted as: ${standaloneQuestion})` : ''}${resultsBlock}` },
    ],
    temperature: 0.1,
    maxTokens: 1400,
  });
}

/* ------------------------------------------------------------------------- */
/* Evidence (built from the actual results, never by the model)               */
/* ------------------------------------------------------------------------- */

const LABELS = {
  patients: 'patient', hospitals: 'hospital', records: 'record', hospitalaccesses: 'consent',
  staffs: 'staff member', formtemplates: 'form', auditlogs: 'audit event', deletionrequests: 'deletion request',
  notifications: 'notification', hospitalupdaterequests: 'update request',
};

function fmtDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function plural(n, word) {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

function describeDoc(doc) {
  const name = doc.displayName || doc.name || doc.patientName || doc.title || doc.patient?.name || doc.hospital?.name;
  const created = fmtDate(doc.createdAt);
  return [name ? `**${name}**` : null, doc.suspended ? 'suspended account' : null, `\`${doc._id}\``, created ? `created ${created}` : null].filter(Boolean).join(' · ');
}

function buildEvidence(evidence, mode, policy = null) {
  const lines = [];
  for (const item of evidence) {
    const label = LABELS[item.collection] || 'document';
    const purpose = item.purpose ? `${item.purpose}: ` : '';
    const r = item.result;
    if (item.error) {
      lines.push(`- ${purpose}could not be checked (${item.error})`);
    } else if (mode === 'semantic_search' && Array.isArray(r)) {
      lines.push(`- ${purpose}${plural(r.length, 'matching record')}`);
      r.slice(0, 8).forEach(hit => lines.push(`  - ${[hit.patientName && `**${hit.patientName}**`, hit.hospitalName, hit.formName, `\`${hit.recordId}\``].filter(Boolean).join(' · ')}`));
    } else if (r && 'count' in r) {
      lines.push(`- ${purpose}counted ${plural(r.count, label)}`);
    } else if (r?.values) {
      lines.push(`- ${purpose}${plural(r.total, 'distinct value')}`);
    } else if (r?.documents) {
      const more = r.total > r.returned ? ` (showing ${r.returned} of ${r.total.toLocaleString()})` : '';
      lines.push(`- ${purpose}${plural(r.total, `matching ${label}`)}${more}`);
      r.documents.slice(0, 10).forEach(doc => lines.push(`  - ${describeDoc(doc)}`));
    } else if (r?.rows) {
      lines.push(`- ${purpose}${plural(r.rows.length, 'result row')}`);
      r.rows.slice(0, 10).forEach(row => {
        const id = typeof row._id === 'string' || typeof row._id === 'number' ? row._id : JSON.stringify(row._id);
        const values = Object.entries(row)
          .filter(([k, v]) => !['_id', 'name'].includes(k) && v !== null && v !== '' && typeof v !== 'object')
          .map(([k, v]) => `${k}: ${typeof v === 'string' && fmtDate(v) && /^\d{4}-/.test(v) ? fmtDate(v) : v}`)
          .join(', ');
        lines.push(`  - ${[row.name && `**${row.name}**`, id !== undefined && id !== null ? `\`${id}\`` : null, values].filter(Boolean).join(' · ')}`);
      });
    }
  }
  if (policy && !policy.includeAll && policy.excluded > 0) {
    lines.push(`- Suspended patients and their data were left out. Ask about suspended patients to include them.`);
  }
  return lines.length ? `\n\n---\n**Evidence** (from the live database)\n${lines.join('\n')}` : '';
}

/* ------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* ------------------------------------------------------------------------- */

export async function answerAdminQuestion({ question, history = [], prefer = null }) {
  let planned = await plan({ question, history, prefer });
  let evidence = [];
  const policy = await createSuspensionPolicy(question, planned.standaloneQuestion);

  if (planned.mode === 'database' && planned.queries.length) {
    try {
      evidence = await Promise.all(planned.queries.map(async q => ({ purpose: q.purpose, collection: q.collection, result: await runQuery(q, policy) })));
    } catch (err) {
      // One repair attempt with the error message fed back to the planner
      planned = await plan({ question, history, previousError: err.message, prefer });
      evidence = await Promise.all(planned.queries.map(async q => {
        try {
          return { purpose: q.purpose, collection: q.collection, result: await runQuery(q, policy) };
        } catch (innerErr) {
          return { purpose: q.purpose, collection: q.collection, error: innerErr.message };
        }
      }));
    }
  } else if (planned.mode === 'semantic_search') {
    try {
      evidence = [{ purpose: 'Records similar to the question', result: await semanticSearch(planned.standaloneQuestion, policy) }];
    } catch (err) {
      evidence = [{ purpose: 'Semantic search', error: `Search index unavailable: ${err.message}` }];
    }
  }

  if (process.env.GOLU_DEBUG) console.log('[golu] plan', JSON.stringify(planned), '\n[golu] evidence', JSON.stringify(evidence).slice(0, 1500));

  const composed = await compose({
    question,
    history,
    standaloneQuestion: planned.standaloneQuestion,
    evidence,
    mode: planned.mode,
    prefer,
  });
  const answer = composed.content;
  const model = {
    provider: composed.provider,
    providerLabel: composed.providerLabel,
    model: composed.model,
    preferredUsed: composed.preferredUsed,
  };

  const evidenceSection = planned.mode === 'conversation' ? '' : buildEvidence(evidence, planned.mode, policy);

  const sources = evidence
    .filter(e => !e.error)
    .map(e => ({ type: planned.mode, collection: e.collection || 'records', purpose: e.purpose, refs: collectRefs(e.result) }));

  // The model is told not to write evidence; drop it if it does, so only the verified list remains
  const modelText = answer.split(/\n\s*(?:-{3,}\s*\n\s*)?(?:#+\s*)?\**\s*(?:evidence|sources)\s*:?\s*\**\s*:?\s*(?:\([^)\n]*\))?\s*:?\s*\n/i)[0].trim();
  const body = (modelText || answer.trim()).replace(/(\n\s*-{3,}\s*)+$/, '').trim();
  return { answer: `${body}${evidenceSection}`, sources, model };
}
