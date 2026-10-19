import React, { useEffect, useMemo, useState } from 'react';
import AppDialog, { DialogButton } from './AppDialog';
import { TagField } from './onboarding/Onboarding';
import { normaliseBloodGroup, parseHeightToCm, cmToFeetInches, bmiCategory } from '../utils/health';

export type HealthSection = 'summary' | 'info';

export interface HealthValues {
  bloodGroup?: string;
  age?: number | string;
  dob?: string;
  height?: string;
  weight?: number | string;
  bmi?: number | string;
  allergies?: string[] | string;
  conditions?: string[] | string;
  medications?: string[] | string;
}

interface Props {
  open: boolean;
  section: HealthSection;
  values: HealthValues;
  saving?: boolean;
  onClose: () => void;
  onSave: (updates: Record<string, unknown>) => void;
}

const COMMON_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
const RARE_GROUPS = [
  { value: 'A1+', note: 'Subtype of A' },
  { value: 'A1−', note: 'Subtype of A' },
  { value: 'A2+', note: 'Subtype of A' },
  { value: 'A2−', note: 'Subtype of A' },
  { value: 'A1B+', note: 'Subtype of AB' },
  { value: 'A2B+', note: 'Subtype of AB' },
  { value: 'Bombay (Oh)', note: 'hh phenotype' },
  { value: 'Para-Bombay', note: 'Weak H antigen' },
  { value: 'Rh-null', note: 'No Rh antigens' },
  { value: 'Weak D (Du)', note: 'Weak Rh D' },
];
const UNKNOWN = 'Not sure';

// Placeholder answers like "N/A" or "None" are not real items, so they don't become tags
const isPlaceholder = (x: string) => /^(n\/?a|none|nil|-|nothing)$/i.test(x.trim());
const toList = (v?: string[] | string) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(x => String(x).trim()).filter(x => x && !isPlaceholder(x)).join(', ');
const fromList = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

const Segmented: React.FC<{ options: string[]; value: string; onChange: (v: string) => void; label: string }> = ({ options, value, onChange, label }) => (
  <div className="hd-seg" role="radiogroup" aria-label={label}>
    {options.map(o => (
      <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? 'is-on' : ''} onClick={() => onChange(o)}>{o}</button>
    ))}
  </div>
);

const HealthDetailsDialog: React.FC<Props> = ({ open, section, values, saving, onClose, onSave }) => {
  const [bloodGroup, setBloodGroup] = useState('');
  const [otherGroup, setOtherGroup] = useState('');
  const [showRare, setShowRare] = useState(false);
  const [age, setAge] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft / in'>('cm');
  const [cm, setCm] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [weight, setWeight] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');

  useEffect(() => {
    if (!open) return;
    const group = normaliseBloodGroup(values.bloodGroup);
    const known = [...COMMON_GROUPS, ...RARE_GROUPS.map(r => r.value), UNKNOWN];
    if (group && !known.includes(group)) { setBloodGroup('Other'); setOtherGroup(group); } else { setBloodGroup(group); setOtherGroup(''); }
    setShowRare(RARE_GROUPS.some(r => r.value === group));
    setAge(values.age ? String(values.age) : '');
    const heightCm = parseHeightToCm(values.height);
    const looksImperial = /'|ft|feet/i.test(String(values.height || ''));
    setHeightUnit(looksImperial ? 'ft / in' : 'cm');
    setCm(heightCm ? String(heightCm) : '');
    if (heightCm) {
      const { ft: f, inch: i } = cmToFeetInches(heightCm);
      setFt(String(f));
      setInch(String(i));
    } else { setFt(''); setInch(''); }
    setWeightUnit('kg');
    setWeight(values.weight ? String(values.weight) : '');
    setAllergies(toList(values.allergies));
    setConditions(toList(values.conditions));
    setMedications(toList(values.medications));
  }, [open, values]);

  const heightInCm = useMemo(() => {
    if (heightUnit === 'cm') return Number(cm) || null;
    const total = (Number(ft) || 0) * 12 + (Number(inch) || 0);
    return total ? Math.round(total * 2.54) : null;
  }, [heightUnit, cm, ft, inch]);

  const weightInKg = useMemo(() => {
    const n = Number(weight);
    if (!n) return null;
    return weightUnit === 'kg' ? n : Math.round(n * 0.453592 * 10) / 10;
  }, [weight, weightUnit]);

  const bmi = heightInCm && weightInKg ? Math.round((weightInKg / Math.pow(heightInCm / 100, 2)) * 10) / 10 : null;
  const category = bmi ? bmiCategory(bmi) : null;
  const ageFromDob = Boolean(values.dob);

  const switchWeightUnit = (unit: string) => {
    const n = Number(weight);
    if (n) setWeight(String(unit === 'lb' ? Math.round(n / 0.453592) : Math.round(n * 0.453592 * 10) / 10));
    setWeightUnit(unit as 'kg' | 'lb');
  };

  const save = () => {
    if (section === 'info') {
      onSave({ allergies: fromList(allergies), conditions: fromList(conditions), medications: fromList(medications) });
      return;
    }
    const updates: Record<string, unknown> = {};
    const group = bloodGroup === 'Other' ? otherGroup.trim() : bloodGroup;
    if (group) updates.bloodGroup = group;
    if (!ageFromDob && age) updates.age = Number(age);
    if (heightInCm) updates.height = heightUnit === 'cm' ? `${heightInCm} cm` : `${Number(ft) || 0}'${Number(inch) || 0}"`;
    if (weightInKg) updates.weight = weightInKg;
    if (bmi) updates.bmi = bmi;
    onSave(updates);
  };

  const bmiMarker = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / (40 - 15)) * 100)) : 0;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size={section === 'summary' ? 'lg' : 'md'}
      eyebrow={section === 'summary' ? 'Health summary' : 'Quick health info'}
      title={section === 'summary' ? 'Your body measurements' : 'Allergies, conditions and medicines'}
      subtitle={section === 'summary'
        ? 'Hospitals you approve see these. BMI is worked out for you.'
        : 'Type one item and press Enter. Doctors see these first, so keep them up to date.'}
      footer={
        <>
          <DialogButton onClick={onClose} disabled={saving}>Cancel</DialogButton>
          <DialogButton variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</DialogButton>
        </>
      }
    >
      {section === 'summary' ? (
        <div className="hd">
          <section>
            <p className="hd-label">Blood group</p>
            <div className="hd-groups" role="radiogroup" aria-label="Blood group">
              {COMMON_GROUPS.map(g => (
                <button key={g} type="button" role="radio" aria-checked={bloodGroup === g} className={`hd-group ${bloodGroup === g ? 'is-on' : ''}`} onClick={() => setBloodGroup(g)}>
                  {g}
                </button>
              ))}
            </div>
            <div className="hd-row-actions">
              <button type="button" className={`hd-chip ${bloodGroup === UNKNOWN ? 'is-on' : ''}`} onClick={() => setBloodGroup(UNKNOWN)}>Not sure</button>
              <button type="button" className={`hd-chip ${showRare ? 'is-open' : ''}`} onClick={() => setShowRare(v => !v)} aria-expanded={showRare}>
                Rare types {showRare ? '▴' : '▾'}
              </button>
              <button type="button" className={`hd-chip ${bloodGroup === 'Other' ? 'is-on' : ''}`} onClick={() => setBloodGroup('Other')}>Something else</button>
            </div>
            {showRare && (
              <div className="hd-rare" role="radiogroup" aria-label="Rare blood types">
                {RARE_GROUPS.map(r => (
                  <button key={r.value} type="button" role="radio" aria-checked={bloodGroup === r.value} className={`hd-rare-item ${bloodGroup === r.value ? 'is-on' : ''}`} onClick={() => setBloodGroup(r.value)}>
                    <span>{r.value}</span><small>{r.note}</small>
                  </button>
                ))}
              </div>
            )}
            {bloodGroup === 'Other' && (
              <input className="hd-input mt-3" placeholder="e.g. Kell negative, Duffy null" value={otherGroup} onChange={e => setOtherGroup(e.target.value)} autoFocus />
            )}
          </section>

          <div className="hd-grid">
            <section>
              <div className="hd-label-row">
                <p className="hd-label">Height</p>
                <Segmented label="Height unit" options={['cm', 'ft / in']} value={heightUnit} onChange={v => setHeightUnit(v as 'cm' | 'ft / in')} />
              </div>
              {heightUnit === 'cm' ? (
                <div className="hd-suffix"><input className="hd-input" inputMode="numeric" value={cm} onChange={e => setCm(e.target.value.replace(/[^\d.]/g, ''))} placeholder="175" /><span>cm</span></div>
              ) : (
                <div className="hd-pair">
                  <div className="hd-suffix"><input className="hd-input" inputMode="numeric" value={ft} onChange={e => setFt(e.target.value.replace(/\D/g, ''))} placeholder="5" /><span>ft</span></div>
                  <div className="hd-suffix"><input className="hd-input" inputMode="numeric" value={inch} onChange={e => setInch(e.target.value.replace(/\D/g, ''))} placeholder="9" /><span>in</span></div>
                </div>
              )}
            </section>

            <section>
              <div className="hd-label-row">
                <p className="hd-label">Weight</p>
                <Segmented label="Weight unit" options={['kg', 'lb']} value={weightUnit} onChange={switchWeightUnit} />
              </div>
              <div className="hd-suffix"><input className="hd-input" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value.replace(/[^\d.]/g, ''))} placeholder={weightUnit === 'kg' ? '64' : '141'} /><span>{weightUnit}</span></div>
            </section>

            <section>
              <p className="hd-label">Age</p>
              {ageFromDob ? (
                <p className="hd-static">{values.age || '—'} years <small>from your date of birth</small></p>
              ) : (
                <div className="hd-suffix"><input className="hd-input" inputMode="numeric" value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ''))} placeholder="34" /><span>years</span></div>
              )}
            </section>

            <section>
              <p className="hd-label">BMI <small>calculated</small></p>
              {bmi && category ? (
                <div>
                  <p className="hd-static"><b>{bmi}</b> <span style={{ color: category.tone }}>{category.label}</span></p>
                  <div className="hd-scale" aria-hidden>
                    <span style={{ left: `${bmiMarker}%` }} />
                  </div>
                  <div className="hd-scale-legend"><span>18.5</span><span>25</span><span>30</span></div>
                </div>
              ) : (
                <p className="hd-static hd-muted">Add height and weight to see it</p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="hd">
          <TagField id="hd-allergies" label="Allergies" value={allergies} onChange={setAllergies} placeholder="e.g. Penicillin, peanuts" />
          <TagField id="hd-conditions" label="Ongoing conditions" value={conditions} onChange={setConditions} placeholder="e.g. Type 2 diabetes" />
          <TagField id="hd-medications" label="Medicines you take" value={medications} onChange={setMedications} placeholder="e.g. Metformin 500 mg twice daily" />
        </div>
      )}
    </AppDialog>
  );
};

export default HealthDetailsDialog;
