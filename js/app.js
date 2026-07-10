const STORAGE_KEY = 'rtk_original_records';
let records = loadRecords();
const today = new Date().toISOString().slice(0, 10);

const YEARS = [
  'Tahun 1',
  'Tahun 2',
  'Tahun 3',
  'Tahun 4',
  'Tahun 5',
  'Tahun 6'
];

const STREAMS = ['Neuron', 'Nexus', 'Nova'];

const MONTHS_MS = [
  'Jan',
  'Feb',
  'Mac',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ogos',
  'Sep',
  'Okt',
  'Nov',
  'Dis'
];

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function id() {
  return 'R' + Date.now() + Math.floor(Math.random() * 999);
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());
}

function num(value) {
  return Number(String(value || '').replace(/[^0-9.]/g, '')) || 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function getClassOptions(yearFilter = '') {
  const years = yearFilter ? [yearFilter] : YEARS;

  return years.flatMap(year =>
    STREAMS.map(stream => `${year} ${stream}`)
  );
}

function normalizeClassName(value, fallbackYear = '') {
  let raw = String(value || '').trim();

  if (!raw) return '';

  raw = raw.replace(/\s+/g, ' ');

  const upper = raw.toUpperCase();

  const stream =
    STREAMS.find(item => upper.includes(item.toUpperCase())) || '';

  let year = '';

  const yearMatch =
    upper.match(/TAHUN\s*([1-6])/) ||
    upper.match(/\b([1-6])\b/);

  if (yearMatch) {
    year = `Tahun ${yearMatch[1]}`;
  }

  if (!year && fallbackYear) {
    year = fallbackYear;
  }

  if (year && stream) {
    return `${year} ${stream}`;
  }

  if (stream && fallbackYear) {
    return `${fallbackYear} ${stream}`;
  }

  return normalizeText(raw);
}

function renderClassDropdown(
  selectId,
  selectedValue = '',
  yearFilter = ''
) {
  const select = document.getElementById(selectId);

  if (!select) return;

  const selected = normalizeClassName(
    selectedValue,
    yearFilter
  );

  select.innerHTML =
    '<option value="">Pilih kelas</option>' +
    getClassOptions(yearFilter)
      .map(kelas => `
        <option
          value="${kelas}"
          ${kelas === selected ? 'selected' : ''}
        >
          ${kelas}
        </option>
      `)
      .join('');
}

function cleanHeaderKey(key) {
  return String(key || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function getValue(row, keys) {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ''
    ) {
      return row[key];
    }
  }

  return '';
}

function normalizeDate(value) {
  if (!value) return today;

  if (typeof value === 'number' && typeof XLSX !== 'undefined') {
    const date = XLSX.SSF.parse_date_code(value);

    if (date) {
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');

      return `${date.y}-${month}-${day}`;
    }
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);

  if (!isNaN(parsed)) {
    return parsed.toISOString().slice(0, 10);
  }

  return today;
}

function monthLabelFromDate(dateString) {
  const date = new Date(dateString);

  if (isNaN(date)) return 'Tidak Pasti';

  return `${MONTHS_MS[date.getMonth()]} ${date.getFullYear()}`;
}

function readingInfo(record) {
  if (record.kategori === 'Iqra') {
    return `Iqra ${record.level || '-'} | M/S ${record.page || '-'}`;
  }

  if (record.kategori === 'Al-Quran') {
    return `Juzuk ${record.level || '-'} | M/S ${record.page || '-'}`;
  }

  if (record.kategori === 'Khatam') {
    return 'Khatam ✓';
  }

  if (record.kategori === 'Mentor') {
    return `Mentor${
      record.mentee ? ' kepada ' + record.mentee : ''
    }`;
  }

  if (record.kategori === 'Tamayyuz') {
    return `${
      record.tam_status || 'Sedang Hafal'
    }${
      record.tam_surah ? ' | ' + record.tam_surah : ''
    }${
      record.tam_ayat ? ' (' + record.tam_ayat + ')' : ''
    }${
      record.mentee ? ' | Mentee: ' + record.mentee : ''
    }`;
  }

  return '-';
}

function score(record) {
  if (record.kategori === 'Al-Quran') {
    return num(record.level) * 1000 + num(record.page);
  }

  if (record.kategori === 'Khatam') {
    return 999999;
  }

  if (record.kategori === 'Tamayyuz') {
    return 888888;
  }

  if (record.kategori === 'Mentor') {
    return 777777;
  }

  return num(record.level) * 100 + num(record.page);
}

function showTab(tab) {
  document
    .querySelectorAll('.tab-content')
    .forEach(section => {
      section.classList.toggle(
        'hidden',
        section.id !== `tab-${tab}`
      );
    });

  document
    .querySelectorAll('.nav-link[data-tab]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.tab === tab
      );
    });

  renderAll();
}

function renderAll() {
  renderDashboard();
  renderTable();
  renderAnalysis();
  populateClassFilters();
}

function renderDashboard() {
  const statTotal = document.getElementById('stat-total');
  const statIqra = document.getElementById('stat-iqra');
  const statQuran = document.getElementById('stat-quran');
  const statTamayyuz = document.getElementById('stat-tamayyuz');

  if (statTotal) {
    statTotal.textContent = records.length;
  }

  if (statIqra) {
    statIqra.textContent = records.filter(
      record => record.kategori === 'Iqra'
    ).length;
  }

  if (statQuran) {
    statQuran.textContent = records.filter(
      record => record.kategori === 'Al-Quran'
    ).length;
  }

  if (statTamayyuz) {
    statTamayyuz.textContent = records.filter(
      record => record.kategori === 'Tamayyuz'
    ).length;
  }

  const quranRecords = records.filter(
    record => record.kategori === 'Al-Quran'
  );

  const averageProgress = quranRecords.length
    ? quranRecords.reduce(
        (total, record) =>
          total + (num(record.page) / 604) * 100,
        0
      ) / quranRecords.length
    : 0;

  const percentage = Math.min(
    100,
    averageProgress
  ).toFixed(1);

  const progressBar =
    document.getElementById('overall-progress');

  const progressText =
    document.getElementById('progress-percent');

  if (progressBar) {
    progressBar.style.width = percentage + '%';
  }

  if (progressText) {
    progressText.textContent = percentage + '%';
  }

  const year6Records = records
    .filter(record => {
      const yearText = String(record.tahun || '').trim();
      const classText = String(record.kelas || '').trim();

      return (
        yearText === 'Tahun 6' ||
        classText.startsWith('Tahun 6')
      );
    })
    .sort((a, b) => {
      const classComparison = String(a.kelas || '')
        .localeCompare(String(b.kelas || ''));

      if (classComparison !== 0) {
        return classComparison;
      }

      return String(a.nama || '')
        .localeCompare(String(b.nama || ''));
    });

  const year6Stat =
    document.getElementById('stat-year6');

  if (year6Stat) {
    year6Stat.textContent = year6Records.length;
  }

  const year6Table =
    document.getElementById('year6-table');

  if (!year6Table) return;

  if (year6Records.length === 0) {
    year6Table.innerHTML = `
      <tr>
        <td colspan="9" class="text-center muted">
          Tiada rekod murid Tahun 6.
        </td>
      </tr>
    `;
    return;
  }

  year6Table.innerHTML = year6Records
    .map((record, index) => `
      <tr>
        <td>${index + 1}</td>

        <td>
          <b>${escapeHtml(record.nama || '-')}</b>
        </td>

        <td>
          ${escapeHtml(record.tahun || '-')}
        </td>

        <td>
          ${escapeHtml(record.kelas || '-')}
        </td>

        <td>
          <span class="badge ${
            record.kehadiran === 'Hadir'
              ? 'badge-green'
              : 'badge-red'
          }">
            ${escapeHtml(record.kehadiran || '-')}
          </span>
        </td>

        <td>
          ${escapeHtml(record.tarikh || '-')}
        </td>

        <td>
          <span class="badge">
            ${escapeHtml(record.kategori || '-')}
          </span>
        </td>

        <td>
          ${escapeHtml(readingInfo(record))}
        </td>

        <td>
          <div class="table-actions">
            <button
              class="link-btn"
              type="button"
              onclick="openEdit('${record.id}')"
            >
              Edit
            </button>

            <button
              class="delete-link"
              type="button"
              onclick="deleteRecord('${record.id}')"
            >
              Padam
            </button>
          </div>
        </td>
      </tr>
    `)
    .join('');
}

function renderTable() {
  const tbody =
    document.getElementById('student-table');

  if (!tbody) return;

  const search = document
    .getElementById('search-input')
    .value
    .toLowerCase()
    .trim();

  const tahun =
    document.getElementById('filter-tahun').value;

  const kelas =
    document.getElementById('filter-kelas').value;

  const status =
    document.getElementById('filter-status').value;

  const kategori =
    document.getElementById('filter-kategori').value;

  const list = records.filter(record =>
    (
      !search ||
      String(record.nama || '')
        .toLowerCase()
        .includes(search)
    ) &&
    (
      !tahun ||
      record.tahun === tahun
    ) &&
    (
      !kelas ||
      record.kelas === kelas
    ) &&
    (
      !status ||
      record.kehadiran === status
    ) &&
    (
      !kategori ||
      record.kategori === kategori
    )
  );

  tbody.innerHTML = list.length
    ? list.map((record, index) => `
      <tr>
        <td>${index + 1}</td>

        <td>
          <b>${escapeHtml(record.nama || '-')}</b>
        </td>

        <td>
          ${escapeHtml(record.tahun || '-')}
        </td>

        <td>
          ${escapeHtml(record.kelas || '-')}
        </td>

        <td>
          <span class="badge ${
            record.kehadiran === 'Hadir'
              ? 'badge-green'
              : 'badge-red'
          }">
            ${escapeHtml(record.kehadiran || '-')}
          </span>
        </td>

        <td>
          ${escapeHtml(record.tarikh || '-')}
        </td>

        <td>
          <span class="badge">
            ${escapeHtml(record.kategori || '-')}
          </span>
        </td>

        <td>
          ${escapeHtml(readingInfo(record))}
        </td>

        <td>
          <div class="table-actions">
            <button
              class="link-btn"
              type="button"
              onclick="openEdit('${record.id}')"
            >
              Edit
            </button>

            <button
              class="delete-link"
              type="button"
              onclick="deleteRecord('${record.id}')"
            >
              Padam
            </button>
          </div>
        </td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="9" class="text-center muted">
          Tiada rekod untuk kelas atau tapisan ini.
        </td>
      </tr>
    `;
}

function populateClassFilters() {
  const select =
    document.getElementById('filter-kelas');

  if (!select) return;

  const current = select.value;

  const year =
    document.getElementById('filter-tahun')?.value || '';

  const options =
    getClassOptions(year);

  select.innerHTML =
    '<option value="">Semua Kelas</option>' +
    options
      .map(kelas => `
        <option
          value="${kelas}"
          ${kelas === current ? 'selected' : ''}
        >
          ${kelas}
        </option>
      `)
      .join('');

  if (
    current &&
    !options.includes(current)
  ) {
    select.value = '';
  }
}

function renderAnalysis() {
  const hadir = records.filter(record =>
    record.kehadiran === 'Hadir' &&
    record.tarikh === today
  ).length;

  const tidakHadir = records.filter(record =>
    record.kehadiran === 'Tidak Hadir' &&
    record.tarikh === today
  ).length;

  const maximum =
    Math.max(hadir, tidakHadir, 1);

  const attendanceChart =
    document.getElementById('attendance-chart');

  if (attendanceChart) {
    attendanceChart.innerHTML = `
      <div class="mini-bar">
        <div style="height:${hadir / maximum * 100}%"></div>
        <b>${hadir}</b>
        <span>Hadir</span>
      </div>

      <div class="mini-bar">
        <div style="height:${tidakHadir / maximum * 100}%"></div>
        <b>${tidakHadir}</b>
        <span>Tidak Hadir</span>
      </div>
    `;
  }

  const categories = {
    'Iqra': 0,
    'Al-Quran': 0,
    'Khatam': 0,
    'Mentor': 0,
    'Tamayyuz': 0
  };

  records.forEach(record => {
    if (
      categories[record.kategori] !== undefined
    ) {
      categories[record.kategori]++;
    }
  });

  renderBarList(
    'category-chart',
    categories
  );

  const ranking = records
    .filter(
      record => record.kategori === 'Al-Quran'
    )
    .sort(
      (a, b) => score(b) - score(a)
    )
    .slice(0, 10);

  const rankingElement =
    document.getElementById('quran-ranking');

  if (rankingElement) {
    rankingElement.innerHTML = ranking.length
      ? ranking
          .map((record, index) => `
            <div>
              <span>
                <b>${index + 1}.</b>
                ${escapeHtml(record.nama || '-')}
              </span>

              <span>
                ${escapeHtml(readingInfo(record))}
              </span>
            </div>
          `)
          .join('')
      : `
        <p class="muted">
          Belum ada ranking Al-Quran.
        </p>
      `;
  }

  renderMonthlyKhatamChart();
  renderJuzukChart();
  renderIqraByYearChart();
}

function renderBarList(elementId, dataObject) {
  const element =
    document.getElementById(elementId);

  if (!element) return;

  const maximum =
    Math.max(...Object.values(dataObject), 1);

  element.innerHTML = Object.entries(dataObject)
    .map(([label, total]) => `
      <div class="bar-row">
        <span>${escapeHtml(label)}</span>

        <div class="bar-track">
          <div
            class="bar-fill"
            style="width:${total / maximum * 100}%"
          ></div>
        </div>

        <b>${total}</b>
      </div>
    `)
    .join('');
}

function renderMonthlyKhatamChart() {
  const data = {};

  records
    .filter(record =>
      record.kategori === 'Khatam'
    )
    .forEach(record => {
      const label =
        monthLabelFromDate(record.tarikh);

      data[label] =
        (data[label] || 0) + 1;
    });

  const element =
    document.getElementById(
      'monthly-khatam-chart'
    );

  if (!element) return;

  if (Object.keys(data).length === 0) {
    element.innerHTML = `
      <p class="muted">
        Belum ada rekod Khatam.
      </p>
    `;
    return;
  }

  renderBarList(
    'monthly-khatam-chart',
    data
  );
}

function renderJuzukChart() {
  const data = {};

  for (let juzuk = 1; juzuk <= 30; juzuk++) {
    data[`Juzuk ${juzuk}`] = 0;
  }

  records
    .filter(record =>
      record.kategori === 'Al-Quran'
    )
    .forEach(record => {
      const juzuk = num(record.level);

      if (juzuk >= 1 && juzuk <= 30) {
        data[`Juzuk ${juzuk}`]++;
      }
    });

  const filtered = Object.fromEntries(
    Object.entries(data).filter(
      ([, total]) => total > 0
    )
  );

  const element =
    document.getElementById('juzuk-chart');

  if (!element) return;

  if (Object.keys(filtered).length === 0) {
    element.innerHTML = `
      <p class="muted">
        Belum ada rekod Al-Quran mengikut Juzuk.
      </p>
    `;
    return;
  }

  renderBarList(
    'juzuk-chart',
    filtered
  );
}

function renderIqraByYearChart() {
  const data = {};

  YEARS.forEach(year => {
    for (let iqra = 1; iqra <= 6; iqra++) {
      data[`${year} - Iqra ${iqra}`] = 0;
    }
  });

  records
    .filter(record =>
      record.kategori === 'Iqra'
    )
    .forEach(record => {
      const iqra = num(record.level);

      const year = YEARS.includes(record.tahun)
        ? record.tahun
        : 'Tahun 1';

      const key =
        `${year} - Iqra ${iqra}`;

      if (data[key] !== undefined) {
        data[key]++;
      }
    });

  const filtered = Object.fromEntries(
    Object.entries(data).filter(
      ([, total]) => total > 0
    )
  );

  const element =
    document.getElementById(
      'iqra-year-chart'
    );

  if (!element) return;

  if (Object.keys(filtered).length === 0) {
    element.innerHTML = `
      <p class="muted">
        Belum ada rekod Iqra mengikut tahun.
      </p>
    `;
    return;
  }

  renderBarList(
    'iqra-year-chart',
    filtered
  );
}

function toggleFields(prefix = 'f') {
  const kategori =
    document.getElementById(
      `${prefix}-kategori`
    ).value;

  if (prefix === 'f') {
    document
      .getElementById('fields-reading')
      .classList
      .toggle(
        'hidden',
        ['Khatam', 'Mentor'].includes(kategori)
      );

    document
      .getElementById('fields-tamayyuz')
      .classList
      .toggle(
        'hidden',
        kategori !== 'Tamayyuz'
      );

    document
      .getElementById('fields-mentee')
      .classList
      .toggle(
        'hidden',
        !(
          kategori === 'Mentor' ||
          kategori === 'Tamayyuz'
        )
      );
  }
}

function buildRecord(prefix) {
  const kategori =
    document.getElementById(
      `${prefix}-kategori`
    ).value;

  const tahun =
    document.getElementById(
      `${prefix}-tahun`
    ).value;

  return {
    id:
      prefix === 'f'
        ? id()
        : document.getElementById('e-id').value,

    nama:
      document
        .getElementById(`${prefix}-nama`)
        .value
        .trim(),

    tahun: tahun,

    kelas:
      normalizeClassName(
        document.getElementById(
          `${prefix}-kelas`
        ).value,
        tahun
      ),

    kehadiran:
      document.getElementById(
        `${prefix}-kehadiran`
      ).value,

    tarikh:
      document.getElementById(
        `${prefix}-tarikh`
      ).value || today,

    kategori: kategori,

    level:
      document.getElementById(
        `${prefix}-level`
      )?.value || '',

    page:
      document.getElementById(
        `${prefix}-page`
      )?.value || '',

    mentee:
      document.getElementById(
        `${prefix}-mentee`
      )?.value || '',

    tam_status:
      document.getElementById(
        'f-tam-status'
      )?.value || '',

    tam_surah:
      document.getElementById(
        'f-tam-surah'
      )?.value || '',

    tam_ayat:
      document.getElementById(
        'f-tam-ayat'
      )?.value || '',

    catatan:
      document
        .getElementById(
          `${prefix}-catatan`
        )
        .value
        .trim()
  };
}

function openEdit(recordId) {
  const record =
    records.find(item => item.id === recordId);

  if (!record) return;

  [
    'id',
    'nama',
    'tahun',
    'kehadiran',
    'tarikh',
    'kategori',
    'level',
    'page',
    'mentee',
    'catatan'
  ].forEach(key => {
    const element =
      document.getElementById(`e-${key}`);

    if (element) {
      element.value = record[key] || '';
    }
  });

  renderClassDropdown(
    'e-kelas',
    record.kelas || '',
    record.tahun || ''
  );

  document
    .getElementById('edit-modal')
    .classList
    .remove('hidden');
}

function closeEdit() {
  document
    .getElementById('edit-modal')
    .classList
    .add('hidden');
}

function deleteRecord(recordId) {
  if (!confirm('Padam rekod ini?')) {
    return;
  }

  records = records.filter(
    record => record.id !== recordId
  );

  saveRecords();
  closeEdit();
  renderAll();
}

function exportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excel library belum load.');
    return;
  }

  const workbook =
    XLSX.utils.book_new();

  const worksheet =
    XLSX.utils.json_to_sheet(records);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Rekod Murid'
  );

  XLSX.writeFile(
    workbook,
    'road-to-khatam-rekod.xlsx'
  );
}

function exportJSON() {
  const blob = new Blob(
    [JSON.stringify(records, null, 2)],
    { type: 'application/json' }
  );

  const anchor =
    document.createElement('a');

  anchor.href =
    URL.createObjectURL(blob);

  anchor.download =
    'road-to-khatam-backup.json';

  anchor.click();

  URL.revokeObjectURL(anchor.href);
}

function importRows(rows) {
  rows.forEach(row => {
    const lower = {};

    Object.keys(row).forEach(key => {
      lower[cleanHeaderKey(key)] = row[key];
    });

    const nama = getValue(
      lower,
      ['nama', 'nama murid', 'name']
    );

    if (!nama) return;

    const rawTahun =
      getValue(
        lower,
        ['tahun', 'tingkatan']
      );

    const rawKelas =
      getValue(
        lower,
        ['kelas']
      );

    let tahun =
      rawTahun
        ? normalizeText(rawTahun)
        : '';

    if (
      tahun &&
      !tahun.toLowerCase().startsWith('tahun')
    ) {
      const yearNumber =
        String(tahun)
          .replace(/[^1-6]/g, '') || '1';

      tahun = `Tahun ${yearNumber}`;
    }

    let kelas =
      normalizeClassName(rawKelas, tahun);

    if (!tahun) {
      const match =
        kelas.match(/Tahun\s[1-6]/);

      tahun =
        match ? match[0] : 'Tahun 1';
    }

    if (!kelas) {
      kelas = `${tahun} Nova`;
    }

    const iqra =
      getValue(lower, ['iqra']);

    const modul =
      getValue(lower, ['modul']);

    const iqraPage =
      getValue(lower, [
        'm/s (iqra)',
        'ms iqra',
        'm/s iqra'
      ]);

    const quran =
      getValue(lower, [
        'quran',
        'al-quran',
        'al quran'
      ]);

    const juzuk =
      getValue(lower, ['juzuk']);

    const mukaSurat =
      getValue(lower, [
        'muka surat',
        'ms',
        'm/s'
      ]);

    const khatam =
      getValue(lower, ['khatam']);

    const mentor =
      getValue(lower, ['mentor']);

    const tamayyuz =
      getValue(lower, ['tamayyuz']);

    const surah =
      getValue(lower, ['surah']);

    const ayat =
      getValue(lower, ['ayat']);

    let kategori = 'Iqra';

    if (tamayyuz || surah || ayat) {
      kategori = 'Tamayyuz';
    } else if (mentor) {
      kategori = 'Mentor';
    } else if (khatam) {
      kategori = 'Khatam';
    } else if (
      juzuk ||
      quran ||
      mukaSurat
    ) {
      kategori = 'Al-Quran';
    } else if (
      iqra ||
      modul ||
      iqraPage
    ) {
      kategori = 'Iqra';
    }

    records.push({
      id: id(),

      nama:
        normalizeText(nama),

      tahun: tahun,

      kelas: kelas,

      kehadiran:
        getValue(
          lower,
          ['kehadiran', 'status']
        ) || 'Hadir',

      tarikh:
        normalizeDate(
          getValue(
            lower,
            ['tarikh', 'date']
          )
        ),

      kategori: kategori,

      level:
        iqra ||
        juzuk ||
        modul ||
        '',

      page:
        iqraPage ||
        mukaSurat ||
        '',

      mentee:
        getValue(
          lower,
          ['mentee', 'nama mentee']
        ) || '',

      tam_status:
        getValue(
          lower,
          ['status hafazan']
        ) || '',

      tam_surah:
        surah || '',

      tam_ayat:
        ayat || '',

      catatan:
        getValue(
          lower,
          ['catatan', 'nota']
        ) || ''
    });
  });

  saveRecords();
  renderAll();
}

function rowsFromSheet(sheet) {
  const matrix =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        header: 1,
        defval: ''
      }
    );

  const headerIndex =
    matrix.findIndex(row =>
      row.some(
        cell =>
          cleanHeaderKey(cell) === 'nama'
      )
    );

  if (headerIndex >= 0) {
    const headers =
      matrix[headerIndex].map(
        header =>
          String(header || '').trim()
      );

    return matrix
      .slice(headerIndex + 1)
      .map(row => {
        const object = {};

        headers.forEach((header, index) => {
          if (header) {
            object[header] =
              row[index] || '';
          }
        });

        return object;
      });
  }

  return XLSX.utils.sheet_to_json(
    sheet,
    {
      range: 0,
      defval: ''
    }
  );
}

async function importFile(file) {
  const extension =
    file.name
      .split('.')
      .pop()
      .toLowerCase();

  if (
    ['xlsx', 'xls'].includes(extension)
  ) {
    const buffer =
      await file.arrayBuffer();

    const workbook =
      XLSX.read(buffer);

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    importRows(
      rowsFromSheet(sheet)
    );

    return;
  }

  const text =
    await file.text();

  if (extension === 'csv') {
    const [
      headerLine,
      ...lines
    ] =
      text
        .split(/\r?\n/)
        .filter(Boolean);

    const headers =
      headerLine
        .split(',')
        .map(header => header.trim());

    const rows =
      lines.map(line => {
        const values =
          line.split(',');

        const object = {};

        headers.forEach(
          (header, index) => {
            object[header] =
              values[index] || '';
          }
        );

        return object;
      });

    importRows(rows);
    return;
  }

  if (extension === 'html') {
    const documentObject =
      new DOMParser()
        .parseFromString(
          text,
          'text/html'
        );

    const tableRows = [
      ...documentObject.querySelectorAll('tr')
    ];

    if (tableRows.length === 0) {
      return;
    }

    const headers = [
      ...tableRows[0]
        .querySelectorAll('th,td')
    ].map(
      cell => cell.textContent.trim()
    );

    const rows =
      tableRows
        .slice(1)
        .map(tableRow => {
          const cells = [
            ...tableRow
              .querySelectorAll('td,th')
          ];

          const object = {};

          headers.forEach(
            (header, index) => {
              object[header] =
                cells[index]
                  ?.textContent
                  .trim() || '';
            }
          );

          return object;
        });

    importRows(rows);
  }
}

document.addEventListener(
  'DOMContentLoaded',
  () => {
    const dateInput =
      document.getElementById('f-tarikh');

    if (dateInput) {
      dateInput.value = today;
    }

    renderClassDropdown(
      'f-kelas',
      '',
      document.getElementById('f-tahun')?.value || ''
    );

    renderClassDropdown(
      'e-kelas',
      '',
      document.getElementById('e-tahun')?.value || ''
    );

    document
      .getElementById('f-tahun')
      ?.addEventListener(
        'change',
        () => {
          renderClassDropdown(
            'f-kelas',
            '',
            document.getElementById('f-tahun').value
          );
        }
      );

    document
      .getElementById('e-tahun')
      ?.addEventListener(
        'change',
        () => {
          renderClassDropdown(
            'e-kelas',
            '',
            document.getElementById('e-tahun').value
          );
        }
      );

    document
      .getElementById('f-kategori')
      ?.addEventListener(
        'change',
        () => toggleFields('f')
      );

    document
      .querySelectorAll(
        '.nav-link[data-tab], [data-tab-target]'
      )
      .forEach(button =>
        button.addEventListener(
          'click',
          event => {
            event.preventDefault();

            showTab(
              button.dataset.tab ||
              button.dataset.tabTarget
            );
          }
        )
      );

    [
      'search-input',
      'filter-status',
      'filter-kategori'
    ].forEach(idValue => {
      document
        .getElementById(idValue)
        ?.addEventListener(
          'input',
          renderTable
        );
    });

    document
      .getElementById('filter-tahun')
      ?.addEventListener(
        'change',
        () => {
          populateClassFilters();
          renderTable();
        }
      );

    document
      .getElementById('filter-kelas')
      ?.addEventListener(
        'change',
        renderTable
      );

    document
      .getElementById('reset-filter')
      ?.addEventListener(
        'click',
        () => {
          [
            'search-input',
            'filter-tahun',
            'filter-kelas',
            'filter-status',
            'filter-kategori'
          ].forEach(idValue => {
            const element =
              document.getElementById(idValue);

            if (element) {
              element.value = '';
            }
          });

          populateClassFilters();
          renderTable();
        }
      );

    document
      .getElementById('add-form')
      ?.addEventListener(
        'submit',
        event => {
          event.preventDefault();

          records.push(
            buildRecord('f')
          );

          saveRecords();

          event.target.reset();

          const newDateInput =
            document.getElementById('f-tarikh');

          if (newDateInput) {
            newDateInput.value = today;
          }

          renderClassDropdown(
            'f-kelas',
            '',
            document.getElementById('f-tahun')?.value || ''
          );

          toggleFields('f');

          const message =
            document.getElementById('form-msg');

          if (message) {
            message.textContent =
              '✓ Rekod berjaya disimpan.';

            message.classList.remove('hidden');
          }

          renderAll();
        }
      );

    document
      .getElementById('edit-form')
      ?.addEventListener(
        'submit',
        event => {
          event.preventDefault();

          const recordId =
            document.getElementById('e-id').value;

          const recordIndex =
            records.findIndex(
              record => record.id === recordId
            );

          if (recordIndex > -1) {
            records[recordIndex] =
              buildRecord('e');

            saveRecords();
            closeEdit();
            renderAll();
          }
        }
      );

    document
      .getElementById('modal-close')
      ?.addEventListener(
        'click',
        closeEdit
      );

    document
      .getElementById('delete-record')
      ?.addEventListener(
        'click',
        () => {
          const recordId =
            document.getElementById('e-id').value;

          deleteRecord(recordId);
        }
      );

    document
      .getElementById('export-excel')
      ?.addEventListener(
        'click',
        exportExcel
      );

    document
      .getElementById('export-excel-top')
      ?.addEventListener(
        'click',
        exportExcel
      );

    document
      .getElementById('export-json')
      ?.addEventListener(
        'click',
        exportJSON
      );

    document
      .getElementById('clear-data')
      ?.addEventListener(
        'click',
        () => {
          if (
            confirm('Padam semua data?')
          ) {
            records = [];
            saveRecords();
            renderAll();
          }
        }
      );

    document
      .getElementById('import-file')
      ?.addEventListener(
        'change',
        async event => {
          const file =
            event.target.files[0];

          if (!file) return;

          await importFile(file);

          const message =
            document.getElementById('data-msg');

          if (message) {
            message.textContent =
              '✓ Data berjaya diimport.';

            message.classList.remove('hidden');
          }

          event.target.value = '';
        }
      );

    document
      .getElementById('print-btn')
      ?.addEventListener(
        'click',
        () => window.print()
      );

    toggleFields('f');
    renderAll();
  }
);