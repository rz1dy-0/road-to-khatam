const STORAGE_KEY = 'rtk_original_records';
let records = loadRecords();
const today = new Date().toISOString().slice(0, 10);

const YEARS = ['Tahun 1', 'Tahun 2', 'Tahun 3', 'Tahun 4', 'Tahun 5', 'Tahun 6'];
const STREAMS = ['Neuron', 'Nexus', 'Nova'];
const MONTHS_MS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

function loadRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function id() {
  return 'R' + Date.now() + Math.floor(Math.random() * 999);
}

function normalizeText(v) {
  return String(v || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function num(v) {
  return Number(String(v || '').replace(/[^0-9.]/g, '')) || 0;
}

function getClassOptions(yearFilter = '') {
  const years = yearFilter ? [yearFilter] : YEARS;
  return years.flatMap(year => STREAMS.map(stream => `${year} ${stream}`));
}

function normalizeClassName(value, fallbackYear = '') {
  let raw = String(value || '').trim();
  if (!raw) return '';

  raw = raw.replace(/\s+/g, ' ');
  const upper = raw.toUpperCase();
  const stream = STREAMS.find(s => upper.includes(s.toUpperCase())) || '';
  let year = '';

  const yearMatch = upper.match(/TAHUN\s*([1-6])/) || upper.match(/\b([1-6])\b/);
  if (yearMatch) year = `Tahun ${yearMatch[1]}`;
  if (!year && fallbackYear) year = fallbackYear;

  if (year && stream) return `${year} ${stream}`;
  if (stream && fallbackYear) return `${fallbackYear} ${stream}`;

  return normalizeText(raw);
}

function renderClassDropdown(selectId, selectedValue = '', yearFilter = '') {
  const select = document.getElementById(selectId);
  if (!select) return;

  const selected = normalizeClassName(selectedValue, yearFilter);
  select.innerHTML =
    '<option value="">Pilih kelas</option>' +
    getClassOptions(yearFilter).map(kelas =>
      `<option value="${kelas}" ${kelas === selected ? 'selected' : ''}>${kelas}</option>`
    ).join('');
}

function cleanHeaderKey(key) {
  return String(key || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function getValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function normalizeDate(value) {
  if (!value) return today;

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const mm = String(date.m).padStart(2, '0');
      const dd = String(date.d).padStart(2, '0');
      return `${date.y}-${mm}-${dd}`;
    }
  }

  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);

  return today;
}

function monthLabelFromDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date)) return 'Tidak Pasti';
  return `${MONTHS_MS[date.getMonth()]} ${date.getFullYear()}`;
}

function readingInfo(r) {
  if (r.kategori === 'Iqra') return `Iqra ${r.level || '-'} | M/S ${r.page || '-'}`;
  if (r.kategori === 'Al-Quran') return `Juzuk ${r.level || '-'} | M/S ${r.page || '-'}`;
  if (r.kategori === 'Khatam') return 'Khatam ✓';
  if (r.kategori === 'Mentor') return `Mentor${r.mentee ? ' kepada ' + r.mentee : ''}`;
  if (r.kategori === 'Tamayyuz') {
    return `${r.tam_status || 'Sedang Hafal'}${r.tam_surah ? ' | ' + r.tam_surah : ''}${r.tam_ayat ? ' (' + r.tam_ayat + ')' : ''}${r.mentee ? ' | Mentee: ' + r.mentee : ''}`;
  }
  return '-';
}

function score(r) {
  if (r.kategori === 'Al-Quran') return num(r.level) * 1000 + num(r.page);
  if (r.kategori === 'Khatam') return 999999;
  if (r.kategori === 'Tamayyuz') return 888888;
  if (r.kategori === 'Mentor') return 777777;
  return num(r.level) * 100 + num(r.page);
}

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(s =>
    s.classList.toggle('hidden', s.id !== `tab-${tab}`)
  );

  document.querySelectorAll('.nav-link[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );

  renderAll();
}

function renderAll() {
  renderDashboard();
  renderTable();
  renderAnalysis();
  populateClassFilters();
}

function renderDashboard() {
  document.getElementById('stat-total').textContent = records.length;
  document.getElementById('stat-iqra').textContent = records.filter(r => r.kategori === 'Iqra').length;
  document.getElementById('stat-quran').textContent = records.filter(r => r.kategori === 'Al-Quran').length;
  document.getElementById('stat-tamayyuz').textContent = records.filter(r => r.kategori === 'Tamayyuz').length;

  const q = records.filter(r => r.kategori === 'Al-Quran');
  const avg = q.length ? q.reduce((a, r) => a + (num(r.page) / 604 * 100), 0) / q.length : 0;
  const pct = Math.min(100, avg).toFixed(1);

  document.getElementById('overall-progress').style.width = pct + '%';
  document.getElementById('progress-percent').textContent = pct + '%';

  const top = [...records].sort((a, b) => score(b) - score(a)).slice(0, 5);

  document.getElementById('top-five').innerHTML = top.length
    ? top.map((r, i) => `<div><span><b>${i + 1}.</b> ${r.nama || '-'}</span><span>${readingInfo(r)}</span></div>`).join('')
    : '<p class="muted">Belum ada rekod.</p>';
}

function renderTable() {
  const tbody = document.getElementById('student-table');
  if (!tbody) return;

  const search = document.getElementById('search-input').value.toLowerCase().trim();
  const tahun = document.getElementById('filter-tahun').value;
  const kelas = document.getElementById('filter-kelas').value;
  const status = document.getElementById('filter-status').value;
  const kat = document.getElementById('filter-kategori').value;

  const list = records.filter(r =>
    (!search || String(r.nama || '').toLowerCase().includes(search)) &&
    (!tahun || r.tahun === tahun) &&
    (!kelas || r.kelas === kelas) &&
    (!status || r.kehadiran === status) &&
    (!kat || r.kategori === kat)
  );

  tbody.innerHTML = list.length
    ? list.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${r.nama || '-'}</b></td>
        <td>${r.tahun || '-'}</td>
        <td>${r.kelas || '-'}</td>
        <td><span class="badge ${r.kehadiran === 'Hadir' ? 'badge-green' : 'badge-red'}">${r.kehadiran || '-'}</span></td>
        <td>${r.tarikh || '-'}</td>
        <td><span class="badge">${r.kategori || '-'}</span></td>
        <td>${readingInfo(r)}</td>
        <td>
          <div class="table-actions">
            <button class="link-btn" onclick="openEdit('${r.id}')">Edit</button>
            <button class="delete-link" onclick="deleteRecord('${r.id}')">Padam</button>
          </div>
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="9" class="text-center muted">Tiada rekod untuk kelas/tapis ini.</td></tr>`;
}

function populateClassFilters() {
  const sel = document.getElementById('filter-kelas');
  if (!sel) return;

  const current = sel.value;
  const year = document.getElementById('filter-tahun')?.value || '';
  const options = getClassOptions(year);

  sel.innerHTML =
    '<option value="">Semua Kelas</option>' +
    options.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');

  if (current && !options.includes(current)) sel.value = '';
}

function renderAnalysis() {
  const hadir = records.filter(r => r.kehadiran === 'Hadir' && r.tarikh === today).length;
  const tidak = records.filter(r => r.kehadiran === 'Tidak Hadir' && r.tarikh === today).length;
  const max = Math.max(hadir, tidak, 1);

  document.getElementById('attendance-chart').innerHTML = `
    <div class="mini-bar"><div style="height:${hadir / max * 100}%"></div><b>${hadir}</b><span>Hadir</span></div>
    <div class="mini-bar"><div style="height:${tidak / max * 100}%"></div><b>${tidak}</b><span>Tidak Hadir</span></div>
  `;

  const cats = {'Iqra':0, 'Al-Quran':0, 'Khatam':0, 'Mentor':0, 'Tamayyuz':0};
  records.forEach(r => { if (cats[r.kategori] != null) cats[r.kategori]++; });
  renderBarList('category-chart', cats);

  const ranking = records
    .filter(r => r.kategori === 'Al-Quran')
    .sort((a, b) => score(b) - score(a))
    .slice(0, 10);

  document.getElementById('quran-ranking').innerHTML = ranking.length
    ? ranking.map((r, i) => `<div><span><b>${i + 1}.</b> ${r.nama || '-'}</span><span>${readingInfo(r)}</span></div>`).join('')
    : '<p class="muted">Belum ada ranking Al-Quran.</p>';

  renderMonthlyKhatamChart();
  renderJuzukChart();
  renderIqraByYearChart();
}

function renderBarList(elementId, dataObj) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const max = Math.max(...Object.values(dataObj), 1);

  el.innerHTML = Object.entries(dataObj).map(([k, v]) => `
    <div class="bar-row">
      <span>${k}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${v / max * 100}%"></div></div>
      <b>${v}</b>
    </div>
  `).join('');
}

function renderMonthlyKhatamChart() {
  const data = {};

  records
    .filter(r => r.kategori === 'Khatam')
    .forEach(r => {
      const label = monthLabelFromDate(r.tarikh);
      data[label] = (data[label] || 0) + 1;
    });

  if (Object.keys(data).length === 0) {
    document.getElementById('monthly-khatam-chart').innerHTML = '<p class="muted">Belum ada rekod Khatam.</p>';
    return;
  }

  renderBarList('monthly-khatam-chart', data);
}

function renderJuzukChart() {
  const data = {};

  for (let i = 1; i <= 30; i++) data[`Juzuk ${i}`] = 0;

  records
    .filter(r => r.kategori === 'Al-Quran')
    .forEach(r => {
      const juzuk = num(r.level);
      if (juzuk >= 1 && juzuk <= 30) data[`Juzuk ${juzuk}`]++;
    });

  const filtered = Object.fromEntries(Object.entries(data).filter(([_, v]) => v > 0));

  if (Object.keys(filtered).length === 0) {
    document.getElementById('juzuk-chart').innerHTML = '<p class="muted">Belum ada rekod Al-Quran mengikut Juzuk.</p>';
    return;
  }

  renderBarList('juzuk-chart', filtered);
}

function renderIqraByYearChart() {
  const data = {};

  YEARS.forEach(year => {
    for (let i = 1; i <= 6; i++) data[`${year} - Iqra ${i}`] = 0;
  });

  records
    .filter(r => r.kategori === 'Iqra')
    .forEach(r => {
      const iqra = num(r.level);
      const year = YEARS.includes(r.tahun) ? r.tahun : 'Tahun 1';
      const key = `${year} - Iqra ${iqra}`;
      if (data[key] !== undefined) data[key]++;
    });

  const filtered = Object.fromEntries(Object.entries(data).filter(([_, v]) => v > 0));

  if (Object.keys(filtered).length === 0) {
    document.getElementById('iqra-year-chart').innerHTML = '<p class="muted">Belum ada rekod Iqra mengikut tahun.</p>';
    return;
  }

  renderBarList('iqra-year-chart', filtered);
}

function toggleFields(prefix = 'f') {
  const kat = document.getElementById(`${prefix}-kategori`).value;

  if (prefix === 'f') {
    document.getElementById('fields-reading').classList.toggle('hidden', ['Khatam','Mentor'].includes(kat));
    document.getElementById('fields-tamayyuz').classList.toggle('hidden', kat !== 'Tamayyuz');
    document.getElementById('fields-mentee').classList.toggle('hidden', !(kat === 'Mentor' || kat === 'Tamayyuz'));
  }
}

function buildRecord(prefix) {
  const kat = document.getElementById(`${prefix}-kategori`).value;
  const tahun = document.getElementById(`${prefix}-tahun`).value;

  return {
    id: prefix === 'f' ? id() : document.getElementById('e-id').value,
    nama: document.getElementById(`${prefix}-nama`).value.trim(),
    tahun: tahun,
    kelas: normalizeClassName(document.getElementById(`${prefix}-kelas`).value, tahun),
    kehadiran: document.getElementById(`${prefix}-kehadiran`).value,
    tarikh: document.getElementById(`${prefix}-tarikh`).value || today,
    kategori: kat,
    level: document.getElementById(`${prefix}-level`)?.value || '',
    page: document.getElementById(`${prefix}-page`)?.value || '',
    mentee: document.getElementById(`${prefix}-mentee`)?.value || '',
    tam_status: document.getElementById('f-tam-status')?.value || '',
    tam_surah: document.getElementById('f-tam-surah')?.value || '',
    tam_ayat: document.getElementById('f-tam-ayat')?.value || '',
    catatan: document.getElementById(`${prefix}-catatan`).value.trim()
  };
}

function openEdit(recordId) {
  const r = records.find(x => x.id === recordId);
  if (!r) return;

  ['id','nama','tahun','kehadiran','tarikh','kategori','level','page','mentee','catatan'].forEach(k => {
    const el = document.getElementById('e-' + k);
    if (el) el.value = r[k] || '';
  });

  renderClassDropdown('e-kelas', r.kelas || '', r.tahun || '');
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEdit() {
  document.getElementById('edit-modal').classList.add('hidden');
}

function deleteRecord(recordId) {
  if (!confirm('Padam rekod ini?')) return;

  records = records.filter(r => r.id !== recordId);
  saveRecords();
  closeEdit();
  renderAll();
}

function exportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excel library belum load.');
    return;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(records), 'Rekod Murid');
  XLSX.writeFile(wb, 'road-to-khatam-rekod.xlsx');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(records, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'road-to-khatam-backup.json';
  a.click();
}

function importRows(rows) {
  rows.forEach(row => {
    const lower = {};

    Object.keys(row).forEach(key => {
      lower[cleanHeaderKey(key)] = row[key];
    });

    const nama = getValue(lower, ['nama', 'nama murid', 'name']);
    if (!nama) return;

    let rawTahun = getValue(lower, ['tahun', 'tingkatan']);
    let rawKelas = getValue(lower, ['kelas']);
    let tahun = rawTahun ? normalizeText(rawTahun) : '';

    if (tahun && !tahun.toLowerCase().startsWith('tahun')) {
      const number = String(tahun).replace(/[^1-6]/g, '') || '1';
      tahun = `Tahun ${number}`;
    }

    let kelas = normalizeClassName(rawKelas, tahun);

    if (!tahun) {
      const m = kelas.match(/Tahun\s[1-6]/);
      tahun = m ? m[0] : 'Tahun 1';
    }

    if (!kelas) kelas = `${tahun} Nova`;

    const iqra = getValue(lower, ['iqra']);
    const modul = getValue(lower, ['modul']);
    const iqraPage = getValue(lower, ['m/s (iqra)', 'ms iqra', 'm/s iqra']);
    const quran = getValue(lower, ['quran', 'al-quran', 'al quran']);
    const juzuk = getValue(lower, ['juzuk']);
    const mukaSurat = getValue(lower, ['muka surat', 'ms', 'm/s']);
    const khatam = getValue(lower, ['khatam']);
    const mentor = getValue(lower, ['mentor']);
    const tamayyuz = getValue(lower, ['tamayyuz']);
    const surah = getValue(lower, ['surah']);
    const ayat = getValue(lower, ['ayat']);

    let kategori = 'Iqra';

    if (tamayyuz || surah || ayat) kategori = 'Tamayyuz';
    else if (mentor) kategori = 'Mentor';
    else if (khatam) kategori = 'Khatam';
    else if (juzuk || quran || mukaSurat) kategori = 'Al-Quran';
    else if (iqra || modul || iqraPage) kategori = 'Iqra';

    records.push({
      id: id(),
      nama: normalizeText(nama),
      tahun: tahun,
      kelas: kelas,
      kehadiran: getValue(lower, ['kehadiran', 'status']) || 'Hadir',
      tarikh: normalizeDate(getValue(lower, ['tarikh', 'date'])),
      kategori: kategori,
      level: iqra || juzuk || modul || '',
      page: iqraPage || mukaSurat || '',
      mentee: getValue(lower, ['mentee', 'nama mentee']) || '',
      tam_status: getValue(lower, ['status hafazan']) || '',
      tam_surah: surah || '',
      tam_ayat: ayat || '',
      catatan: getValue(lower, ['catatan', 'nota']) || ''
    });
  });

  saveRecords();
  renderAll();
}

function rowsFromSheet(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {header: 1, defval: ''});
  const headerIndex = matrix.findIndex(row => row.some(cell => cleanHeaderKey(cell) === 'nama'));

  if (headerIndex >= 0) {
    const headers = matrix[headerIndex].map(h => String(h || '').trim());
    return matrix.slice(headerIndex + 1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i] || '';
      });
      return obj;
    });
  }

  return XLSX.utils.sheet_to_json(sheet, {range: 0, defval: ''});
}

async function importFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (['xlsx','xls'].includes(ext)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    importRows(rowsFromSheet(sheet));
    return;
  }

  const text = await file.text();

  if (ext === 'csv') {
    const [head, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = head.split(',').map(h => h.trim());

    const rows = lines.map(l => {
      const v = l.split(',');
      const o = {};
      headers.forEach((h, i) => o[h] = v[i] || '');
      return o;
    });

    importRows(rows);
    return;
  }

  if (ext === 'html') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const trs = [...doc.querySelectorAll('tr')];
    const heads = [...trs[0].querySelectorAll('th,td')].map(x => x.textContent.trim());

    const rows = trs.slice(1).map(tr => {
      const cells = [...tr.querySelectorAll('td,th')];
      const o = {};
      heads.forEach((h, i) => o[h] = cells[i]?.textContent.trim() || '');
      return o;
    });

    importRows(rows);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-tarikh').value = today;

  renderClassDropdown('f-kelas', '', document.getElementById('f-tahun').value);
  renderClassDropdown('e-kelas', '', document.getElementById('e-tahun').value);

  document.getElementById('f-tahun').addEventListener('change', () =>
    renderClassDropdown('f-kelas', '', document.getElementById('f-tahun').value)
  );

  document.getElementById('e-tahun').addEventListener('change', () =>
    renderClassDropdown('e-kelas', '', document.getElementById('e-tahun').value)
  );

  document.getElementById('f-kategori').addEventListener('change', () => toggleFields('f'));

  document.querySelectorAll('.nav-link[data-tab], [data-tab-target]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.preventDefault();
      showTab(btn.dataset.tab || btn.dataset.tabTarget);
    })
  );

  ['search-input','filter-status','filter-kategori'].forEach(x =>
    document.getElementById(x).addEventListener('input', renderTable)
  );

  document.getElementById('filter-tahun').addEventListener('change', () => {
    populateClassFilters();
    renderTable();
  });

  document.getElementById('filter-kelas').addEventListener('change', renderTable);

  document.getElementById('reset-filter').addEventListener('click', () => {
    ['search-input','filter-tahun','filter-kelas','filter-status','filter-kategori'].forEach(x =>
      document.getElementById(x).value = ''
    );
    populateClassFilters();
    renderTable();
  });

  document.getElementById('add-form').addEventListener('submit', e => {
    e.preventDefault();

    records.push(buildRecord('f'));
    saveRecords();

    e.target.reset();
    document.getElementById('f-tarikh').value = today;
    renderClassDropdown('f-kelas', '', document.getElementById('f-tahun').value);
    toggleFields('f');

    document.getElementById('form-msg').textContent = '✓ Rekod berjaya disimpan.';
    document.getElementById('form-msg').classList.remove('hidden');

    renderAll();
  });

  document.getElementById('edit-form').addEventListener('submit', e => {
    e.preventDefault();

    const idx = records.findIndex(r => r.id === document.getElementById('e-id').value);

    if (idx > -1) {
      records[idx] = buildRecord('e');
      saveRecords();
      closeEdit();
      renderAll();
    }
  });

  document.getElementById('modal-close').addEventListener('click', closeEdit);

  document.getElementById('delete-record').addEventListener('click', () =>
    deleteRecord(document.getElementById('e-id').value)
  );

  document.getElementById('export-excel').addEventListener('click', exportExcel);
  document.getElementById('export-excel-top').addEventListener('click', exportExcel);
  document.getElementById('export-json').addEventListener('click', exportJSON);

  document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('Padam semua data?')) {
      records = [];
      saveRecords();
      renderAll();
    }
  });

  document.getElementById('import-file').addEventListener('change', async e => {
    if (e.target.files[0]) {
      await importFile(e.target.files[0]);
      document.getElementById('data-msg').textContent = '✓ Data berjaya diimport.';
      document.getElementById('data-msg').classList.remove('hidden');
    }
  });

  document.getElementById('print-btn').addEventListener('click', () => window.print());

  toggleFields('f');
  renderAll();
});
