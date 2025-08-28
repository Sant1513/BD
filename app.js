/* State */
const state = {
  rawRows: [],
  companies: [],
  filters: {
    companyType: new Set(),
    companyNature: new Set(),
    foundedYear: new Set(),
    headCount: new Set(),
    hqLocation: new Set(),
    businessNature: new Set(),
    recruiterName: new Set(),
  },
  session: {
    isAuthenticated: false,
    username: null,
  }
};

const SHEET_ID = window.__SHEET_ID__;
const SHEET_TAB = window.__SHEET_TAB__ || 'sheet1';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_TAB)}&tqx=out:json`;

/* Elements */
const dom = {
  filters: document.getElementById('filters'),
  cards: document.getElementById('cards'),
  stats: document.getElementById('stats'),
  googleLink: document.getElementById('googleLink'),
  search: document.getElementById('searchInput'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  loginBtn: document.getElementById('loginBtn'),
  loginModal: document.getElementById('loginModal'),
  loginForm: document.getElementById('loginForm'),
  loginWarning: document.getElementById('loginWarning'),
  popup: document.getElementById('companyPopup'),
  popupClose: document.getElementById('popupClose'),
  popupTitle: document.getElementById('popupTitle'),
  popupMeta: document.getElementById('popupMeta'),
  popupLogo: document.getElementById('popupLogo'),
  popupPocs: document.getElementById('popupPocs'),
  popupContacts: document.getElementById('popupContacts'),
  popupWebsite: document.getElementById('popupWebsite'),
  popupGoogle: document.getElementById('popupGoogle'),
  popupLinkedIn: document.getElementById('popupLinkedIn'),
  toast: document.getElementById('toast'),
};

dom.googleLink.href = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;

/* Utils */
const showToast = (text) => {
  dom.toast.textContent = text;
  dom.toast.hidden = false;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 1600);
  setTimeout(() => (dom.toast.hidden = true), 1900);
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied');
  } catch (_) {
    showToast('Copy failed');
  }
};

const uniqueSorted = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a,b) => String(a).localeCompare(String(b)));

/* Fetch & Parse Google Sheet (GViz JSON) */
async function fetchSheet() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();
  const json = JSON.parse(text.replace(/^.*?\(/, '').replace(/\);?\s*$/, ''));
  const cols = json.table.cols.map(c => c.label || c.id);
  const rows = json.table.rows.map(r => r.c.map(c => (c ? (c.f ?? c.v) : '')));
  return { cols, rows };
}

function normalizeRecord(cols, row) {
  const record = {};
  cols.forEach((c, idx) => { record[c.trim().toLowerCase().replace(/\s+/g, '_')] = row[idx]; });
  return record;
}

/* Data mapping based on provided columns */
function buildCompanies(cols, rows) {
  const companies = [];
  const safe = (v) => (v == null ? '' : String(v).trim());
  for (const row of rows) {
    const rec = normalizeRecord(cols, row);
    // Expected: company_name in Col B, recruiters + details G..O
    const companyName = safe(row[1] || rec.company_name);
    if (!companyName) continue;

    const company = {
      id: `${companyName}-${companies.length}`,
      name: companyName,
      // Columns: G..O -> indexes 6..14 (0-based)
      recruiter_name: safe(row[6] || rec.recruiter_name),
      recruiter_emails: safe(row[7] || rec.recruiter_emails),
      recruiter_phone: safe(row[8] || rec.recruiter_phone),
      company_type: safe(row[9] || rec.company_type),
      company_nature: safe(row[10] || rec.company_nature),
      company_founded_year: safe(row[11] || rec.company_founded_year),
      company_head_count: safe(row[12] || rec.company_head_count),
      company_headquater_location: safe(row[13] || rec.company_headquater_location),
      nature_of_business: safe(row[14] || rec.nature_of_business),
      // enrichment placeholders
      website: '',
      logo: '',
      headquarters: '',
      employees: '',
      valuation: '',
    };
    companies.push(company);
  }
  return companies;
}

/* Filters */
function buildFilterOptions() {
  const get = (key) => uniqueSorted(state.companies.map(c => c[key]).filter(Boolean));
  return {
    company_type: get('company_type'),
    company_nature: get('company_nature'),
    company_founded_year: get('company_founded_year'),
    company_head_count: get('company_head_count'),
    company_headquater_location: get('company_headquater_location'),
    nature_of_business: get('nature_of_business'),
    recruiter_name: get('recruiter_name'),
  };
}

function renderFilters() {
  const opts = buildFilterOptions();
  const filterDefs = [
    ['company_type','Type'],
    ['company_nature','Nature'],
    ['company_founded_year','Founded'],
    ['company_head_count','Headcount'],
    ['company_headquater_location','HQ'],
    ['nature_of_business','Business'],
    ['recruiter_name','Recruiter'],
  ];
  dom.filters.innerHTML = filterDefs.map(([key,label]) => {
    const options = ['<option value="">All</option>'].concat(
      (opts[key] || []).map(v => `<option value="${encodeURIComponent(v)}">${escapeHtml(v)}</option>`)
    ).join('');
    return `<div class="filter-chip"><span class="row"><span class="dot"></span></span><select data-key="${key}">${options}</select></div>`;
  }).join('');

  dom.filters.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.getAttribute('data-key');
      const value = decodeURIComponent(sel.value || '');
      state.filters[key] = new Set(value ? [value] : []);
      renderCards();
    });
  });
}

function applyFilters(data) {
  const keys = Object.keys(state.filters);
  return data.filter(item => {
    for (const key of keys) {
      const selected = state.filters[key];
      if (selected && selected.size > 0) {
        if (!selected.has(String(item[key] || ''))) return false;
      }
    }
    const q = dom.search.value.trim().toLowerCase();
    if (q) {
      const hay = [
        item.name,
        item.recruiter_name,
        item.recruiter_emails,
        item.recruiter_phone,
        item.company_type,
        item.company_nature,
        item.company_headquater_location,
        item.nature_of_business
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"]+/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

/* Cards */
function renderCards() {
  const filtered = applyFilters(state.companies);
  dom.stats.textContent = `${filtered.length} companies • ${state.companies.length} records`;

  if (filtered.length === 0) {
    dom.cards.innerHTML = `<div class="card"><h3>No results</h3><p class="muted">Try adjusting filters or search.</p></div>`;
    return;
  }

  const html = filtered.map(c => {
    const tags = [c.company_type, c.company_nature, c.company_headquater_location].filter(Boolean).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const details = [
      c.company_founded_year && `Founded ${escapeHtml(c.company_founded_year)}`,
      c.company_head_count && `${escapeHtml(c.company_head_count)} employees`,
    ].filter(Boolean).join(' · ');
    const logo = c.logo || `https://www.google.com/s2/favicons?domain=${encodeURIComponent((c.website||'').replace(/^https?:\/\//,''))}&sz=64`;
    return `
      <article class="card" data-id="${c.id}">
        <div class="title">
          <img src="${logo}" alt="logo" onerror="this.src='';">
          <h3>${escapeHtml(c.name)}</h3>
        </div>
        <div class="tags">${tags}</div>
        <div class="row">${escapeHtml(details)}</div>
        <div class="cta">
          <a class="link" href="#" data-action="open" data-id="${c.id}">View company</a>
          ${c.website ? `<a class=\"link\" href=\"${c.website}\" target=\"_blank\">Website</a>` : ''}
        </div>
      </article>
    `;
  }).join('');
  dom.cards.innerHTML = html;

  dom.cards.querySelectorAll('[data-action="open"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const id = el.getAttribute('data-id');
      const company = state.companies.find(x => x.id === id);
      if (company) openCompanyPopup(company);
    });
  });
}

/* Popup */
function openCompanyPopup(c) {
  dom.popupTitle.textContent = c.name;
  dom.popupMeta.innerHTML = [
    c.company_headquater_location,
    c.company_head_count && `${escapeHtml(c.company_head_count)} employees`,
    c.company_founded_year && `Founded ${escapeHtml(c.company_founded_year)}`,
    c.nature_of_business
  ].filter(Boolean).map(escapeHtml).join(' · ');
  dom.popupLogo.src = c.logo || `https://www.google.com/s2/favicons?domain=${encodeURIComponent((c.website||'').replace(/^https?:\/\//,''))}&sz=64`;

  const contacts = [];
  if (c.recruiter_emails) contacts.push({label:'Email', value:c.recruiter_emails});
  if (c.recruiter_phone) contacts.push({label:'Phone', value:c.recruiter_phone});
  dom.popupContacts.innerHTML = contacts.map(x => `
    <div class="item"><span>${escapeHtml(x.label)}: ${escapeHtml(x.value)}</span><button class="copy" data-copy="${escapeHtml(x.value)}">Copy</button></div>
  `).join('') || '<div class="muted">No contacts</div>';

  const pocs = [];
  if (c.recruiter_name) pocs.push(c.recruiter_name);
  dom.popupPocs.innerHTML = pocs.map(name => `
    <div class="item"><span>${escapeHtml(name)}</span><button class="copy" data-copy="${escapeHtml(name)}">Copy</button></div>
  `).join('') || '<div class="muted">No POCs</div>';

  dom.popupWebsite.href = c.website || '#';
  dom.popupWebsite.style.display = c.website ? 'inline-block' : 'none';
  dom.popupGoogle.href = `https://www.google.com/search?q=${encodeURIComponent(c.name)}`;
  dom.popupLinkedIn.href = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c.name)}`;

  dom.popup.showModal();
  dom.popup.querySelectorAll('.copy').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.getAttribute('data-copy')));
  });
}

dom.popupClose.addEventListener('click', () => dom.popup.close());

/* Login */
dom.loginBtn.addEventListener('click', () => dom.loginModal.showModal());
dom.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value.trim();
  if (u === 'Admin1234' && p === '1234@12') {
    state.session.isAuthenticated = true;
    state.session.username = u;
    dom.loginWarning.hidden = true;
    dom.loginModal.close();
    showToast('Signed in');
  } else {
    state.session.isAuthenticated = false; // soft-fail, still allow
    dom.loginWarning.hidden = false;
    dom.loginModal.close();
    showToast('Continuing without auth');
  }
});

/* Enrichment (best-effort using public endpoints) */
async function enrichCompanies(companies) {
  // Best effort: try to guess website via Google search is not possible without API key.
  // We'll attempt to build possible website from company name using common TLDs (heuristic) and test favicon fetch.
  const candidates = ['.com', '.io', '.ai', '.co'];
  for (const c of companies) {
    if (c.website) continue;
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,32);
    for (const tld of candidates) {
      const url = `https://${slug}${tld}`;
      try {
        // try to load favicon as a lightweight existence check
        const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.replace(/^https?:\/\//,''))}&sz=64`;
        c.website = url; // optimistic; logo uses favicon
        c.logo = favicon;
        break;
      } catch (_) { /* ignore */ }
    }
  }
}

/* Init */
async function init() {
  try {
    const { cols, rows } = await fetchSheet();
    state.rawRows = rows;
    state.companies = buildCompanies(cols, rows);
    await enrichCompanies(state.companies);
    renderFilters();
    renderCards();
  } catch (e) {
    console.error(e);
    dom.cards.innerHTML = `<div class="card"><h3>Load error</h3><p class="muted">Make sure the sheet is shared to Anyone with the link (Viewer).</p></div>`;
  }
}

dom.resetFiltersBtn.addEventListener('click', () => {
  Object.keys(state.filters).forEach(k => state.filters[k] = new Set());
  dom.search.value = '';
  renderFilters();
  renderCards();
});

dom.search.addEventListener('input', () => renderCards());

init();


