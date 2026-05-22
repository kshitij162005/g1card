import jsPDF from 'jspdf';

export interface MedicalRecordPdfInput {
    _id: string;
    hospital?: { _id?: string; name?: string; logoUrl?: string };
    form?: { _id?: string; name?: string; description?: string; fields?: any[] };
    data?: any;
    createdAt?: string;
    updatedAt?: string;
}

export interface MedicalPdfBranding {
    primaryColor?: string;
    logoUrl?: string;
    hospitalName?: string;
}

export interface MedicalPdfOptions {
    patientName?: string;
    branding?: MedicalPdfBranding;
    watermarkText?: string;
    watermarkOpacity?: number;
    showTimestamp?: boolean;
}

const DEFAULT_BRANDING = {
    primaryColor: '#2563EB',
};

const WATERMARK_LINES = ['CONFIDENTIAL', 'G1CARD VERIFIED'];

const asText = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ');
    if (typeof value === 'object') {
        if (value.name) return asText(value.name);
        if (value.label) return asText(value.label);
        if (value.value) return asText(value.value);
        return Object.entries(value)
            .map(([key, entryValue]) => `${key.replace(/_/g, ' ')}: ${asText(entryValue)}`)
            .filter(Boolean)
            .join(', ');
    }
    return String(value).trim();
};

const titleCase = (value: string) => value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeKey = (value: string) => value.trim().toLowerCase();

const pickFromRecord = (recordData: any, keys: string[]) => {
    if (!recordData) return '';
    const normalized = Object.entries(recordData || {}).map(([key, val]) => [normalizeKey(key), val] as const);
    for (const key of keys) {
        const direct = recordData?.[key];
        if (direct !== undefined && direct !== null && asText(direct)) return asText(direct);
        const found = normalized.find(([entryKey]) => entryKey === normalizeKey(key));
        if (found && asText(found[1])) return asText(found[1]);
    }
    return '';
};

const detectSection = (key: string) => {
    const lowered = normalizeKey(key);
    if (/(patient|name|age|gender|blood|dob|dob|height|weight|address|phone|email)/.test(lowered)) return 'Patient Info';
    if (/(vital|bp|pressure|pulse|spo2|oxygen|temperature|respiratory)/.test(lowered)) return 'Vitals';
    if (/(medicine|medication|drug|prescription|dose|dosage|tablet)/.test(lowered)) return 'Medicines';
    if (/(lab|test|result|report|investigation|pathology)/.test(lowered)) return 'Lab Results';
    if (/(diagnosis|note|observation|symptom|complaint|summary|impression)/.test(lowered)) return 'Doctor Notes';
    if (/(follow|review|next|advice|instruction|recommendation)/.test(lowered)) return 'Follow-up';
    return 'Additional Medical Data';
};

const collectSections = (recordData: any) => {
    const buckets: Record<string, Array<{ label: string; value: any }>> = {
        'Patient Info': [],
        Vitals: [],
        Medicines: [],
        'Lab Results': [],
        'Doctor Notes': [],
        'Follow-up': [],
        'Additional Medical Data': [],
    };

    Object.entries(recordData || {}).forEach(([key, value]) => {
        const section = detectSection(key);
        buckets[section].push({ label: key, value });
    });

    return Object.entries(buckets)
        .filter(([, items]) => items.length > 0)
        .map(([title, items]) => ({ title, items }));
};

const isLongText = (value: string) => value.length > 120 || value.includes('\n');

const hexToRgb = (hex: string) => {
    const value = hex.replace('#', '');
    const normalized = value.length === 3
        ? value.split('').map((c) => c + c).join('')
        : value;
    const intValue = parseInt(normalized, 16);
    return {
        r: (intValue >> 16) & 255,
        g: (intValue >> 8) & 255,
        b: intValue & 255,
    };
};

const applyWatermark = (doc: jsPDF, pageW: number, pageH: number, text: string, opacity: number) => {
    const gState = (doc as any).GState ? new (doc as any).GState({ opacity }) : null;
    if ((doc as any).saveGraphicsState) (doc as any).saveGraphicsState();
    if (gState && (doc as any).setGState) (doc as any).setGState(gState);

    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    const rows = 6;
    const cols = 3;
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const x = 40 + col * (pageW / 3.2);
            const y = 120 + row * 120;
            doc.text(text, x, y, { angle: -35 });
        }
    }

    if ((doc as any).restoreGraphicsState) (doc as any).restoreGraphicsState();
};

const drawKeyValue = (doc: jsPDF, label: string, value: string, x: number, y: number, width: number) => {
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, x, y);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(value || '—', x + width, y, { align: 'right' });
};

const wrapText = (doc: jsPDF, text: string, maxWidth: number) => doc.splitTextToSize(text, maxWidth);

const renderValue = (
    doc: jsPDF,
    label: string,
    value: any,
    x: number,
    y: number,
    contentWidth: number,
    indent = 0,
): number => {
    const labelText = titleCase(label);
    const labelX = x + indent;
    const valueX = x + contentWidth;

    if (Array.isArray(value)) {
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(labelText, labelX, y);
        y += 12;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        value.forEach((item) => {
            const bulletLines = wrapText(doc, asText(item) || '—', contentWidth - 20);
            doc.text('•', labelX + 6, y);
            doc.text(bulletLines, labelX + 16, y);
            y += 12 + (bulletLines.length - 1) * 10;
        });
        return y + 4;
    }

    if (value && typeof value === 'object') {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(labelText, labelX, y);
        y += 12;
        Object.entries(value).forEach(([childKey, childValue]) => {
            y = renderValue(doc, childKey, childValue, x, y, contentWidth, indent + 12);
        });
        return y + 4;
    }

    const textValue = asText(value) || '—';
    if (isLongText(textValue)) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(labelText, labelX, y);
        y += 12;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        const lines = wrapText(doc, textValue, contentWidth - indent - 4);
        doc.text(lines, labelX, y);
        return y + lines.length * 10 + 4;
    }

    drawKeyValue(doc, labelText, textValue, labelX, y, contentWidth);
    return y + 12;
};

export const generateMedicalPDF = async (record: MedicalRecordPdfInput, options: MedicalPdfOptions = {}) => {
    const safeRecord = JSON.parse(JSON.stringify(record ?? {}));
    const recordData = safeRecord?.data || {};
    const branding = { ...DEFAULT_BRANDING, ...(options.branding || {}) };
    const hospitalName = options.branding?.hospitalName || safeRecord.hospital?.name || 'Hospital';
    const patientName = options.patientName || pickFromRecord(recordData, ['patientName', 'patient_name', 'name', 'patient']);
    const recordId = safeRecord._id || '';
    const timestamp = options.showTimestamp === false ? '' : new Date().toLocaleString('en-IN');
    const watermarkText = [...WATERMARK_LINES, `Generated for: ${patientName || 'Patient'}`, recordId ? `Record ID: ${recordId}` : '', timestamp]
        .filter(Boolean)
        .join('  •  ');

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pageW - margin * 2;
    const { r, g, b } = hexToRgb(branding.primaryColor || '#2563EB');

    const applyHeader = () => {
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageW, pageH, 'F');
        applyWatermark(doc, pageW, pageH, watermarkText, options.watermarkOpacity ?? 0.06);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(r, g, b);
        doc.text(hospitalName, margin, 52);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text('G1CARD Medical Prescription', margin, 68);

        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Prescription Record', pageW - margin, 52, { align: 'right' });

        doc.setDrawColor(203, 213, 225);
        doc.line(margin, 80, pageW - margin, 80);
    };

    const ensureSpace = (y: number, needed: number) => {
        if (y + needed > pageH - 80) {
            doc.addPage();
            applyHeader();
            return 110;
        }
        return y;
    };

    applyHeader();
    let y = 110;

    // Meta grid
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const metaItems = [
        ['Record ID', recordId || '—'],
        ['Hospital', hospitalName],
        ['Form', safeRecord.form?.name || 'Medical Record'],
        ['Date', safeRecord.createdAt ? new Date(safeRecord.createdAt).toLocaleString('en-IN') : timestamp],
    ];
    const metaBoxW = (contentWidth - 16) / 2;
    metaItems.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const boxX = margin + col * (metaBoxW + 16);
        const boxY = y + row * 44;
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(boxX, boxY, metaBoxW, 36, 6, 6, 'FD');
        doc.setTextColor(100, 116, 139);
        doc.text(item[0], boxX + 10, boxY + 14);
        doc.setTextColor(30, 41, 59);
        doc.text(item[1], boxX + 10, boxY + 28);
    });
    y += 96;

    const sections = collectSections(recordData);
    sections.forEach((section) => {
        y = ensureSpace(y, 40);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, y, contentWidth, 26, 6, 6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(r, g, b);
        doc.text(section.title.toUpperCase(), margin + 12, y + 17);
        y += 36;

        section.items.forEach((item) => {
            y = ensureSpace(y, 20);
            y = renderValue(doc, item.label, item.value, margin + 6, y, contentWidth - 12);
        });
        y += 6;
    });

    y = ensureSpace(y, 80);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 72, 8, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(r, g, b);
    doc.text('Record Metadata', margin + 12, y + 18);
    y += 34;
    renderValue(doc, 'Patient Name', patientName || '—', margin + 12, y, contentWidth - 24);

    // Signature block
    y = ensureSpace(y + 40, 90);
    const signatureX = pageW - margin - 180;
    const signatureY = Math.max(y, pageH - 150);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(signatureX, signatureY, 180, 80, 8, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(pickFromRecord(recordData, ['doctor', 'doctor_name', 'physician']) || 'Attending Physician', signatureX + 12, signatureY + 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(pickFromRecord(recordData, ['speciality', 'specialty', 'department']) || 'Department', signatureX + 12, signatureY + 38);
    doc.text('Digital Signature', signatureX + 12, signatureY + 64);
    doc.setDrawColor(148, 163, 184);
    doc.line(signatureX + 12, signatureY + 54, signatureX + 168, signatureY + 54);

    const totalPages = doc.getNumberOfPages();
    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
        doc.setPage(pageIndex);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('This document is digitally verified by G1CARD. Unauthorized modifications invalidate authenticity.', margin, pageH - 24);
        doc.text(`Page ${pageIndex} of ${totalPages}`, pageW - margin, pageH - 24, { align: 'right' });
    }

    return doc.output('blob');
};
