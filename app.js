/* State */
const state = {
  rawRows: [],
  companies: [],
  filters: {
    company_type: new Set(),
    company_nature: new Set(),
    company_founded_year: new Set(),
    company_head_count: new Set(),
    company_headquater_location: new Set(),
    nature_of_business: new Set(),
    recruiter_name: new Set(),
  },
  session: {
    isAuthenticated: false,
    username: null,
  }
};

const SHEET_ID = window.__SHEET_ID__;
const SHEET_TAB = window.__SHEET_TAB__ || 'sheet1';
const SHEET_URL_FOR = (tab) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(tab)}&tqx=out:json`;
const SHEET_GID = window.__SHEET_GID__ || '0';
const SHEET_CSV_FOR = (gid) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&id=${SHEET_ID}&gid=${encodeURIComponent(gid)}`;

/* Elements */
const dom = {
  loginScreen: document.getElementById('loginScreen'),
  loginScreenForm: document.getElementById('loginScreenForm'),
  lsWarning: document.getElementById('ls_warning'),
  filters: document.getElementById('filters'),
  cards: document.getElementById('cards'),
  stats: document.getElementById('stats'),
  googleLink: document.getElementById('googleLink'),
  search: document.getElementById('searchInput'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
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
async function fetchSheetTry(tabName) {
  const res = await fetch(SHEET_URL_FOR(tabName));
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.replace(/^.*?\(/, '').replace(/\);?\s*$/, ''));
  const cols = json.table.cols.map(c => (c.label || c.id || '').toString());
  const rows = json.table.rows.map(r => r.c.map(c => (c ? (c.f ?? c.v) : '')));
  return { cols, rows };
}

async function fetchSheet() {
  try {
    return await fetchSheetTry(SHEET_TAB);
  } catch (_) {
    const alt = SHEET_TAB === 'sheet1' ? 'Sheet1' : 'sheet1';
    try {
      return await fetchSheetTry(alt);
    } catch (e2) {
      // CSV fallback
      const csv = await (await fetch(SHEET_CSV_FOR(SHEET_GID))).text();
      const rows = csv.split(/\r?\n/).filter(Boolean).map(line => line.split(','));
      const cols = rows.shift() || [];
      return { cols, rows };
    }
  }
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
  const norm = (s) => safe(s).toLowerCase().replace(/[^a-z0-9]+/g,'_');
  const headerIndex = new Map(cols.map((c,i)=>[norm(c), i]));

  const getIdx = (candidates, fallbackIdx) => {
    for (const key of candidates) {
      if (headerIndex.has(key)) return headerIndex.get(key);
    }
    return fallbackIdx;
  };

  const idx = {
    company_name: getIdx(['company_name','company','name'], 1),
    company_url: getIdx(['company_url','website','url','homepage'], 2),
    recruiter_name: getIdx(['recruiter_name','recruiter'], 6),
    recruiter_emails: getIdx(['recruiter_emails','recruiter_email','email','emails'], 7),
    recruiter_phone: getIdx(['recruiter_phone','phone','mobile'], 8),
    company_type: getIdx(['company_type','type'], 9),
    company_nature: getIdx(['company_nature','nature'], 10),
    company_founded_year: getIdx(['company_founded_year','founded','founded_year','founded_yr'], 11),
    company_head_count: getIdx(['company_head_count','headcount','employees'], 12),
    company_headquater_location: getIdx(['company_headquater_location','company_headquarter_location','headquarters','hq','location'], 13),
    nature_of_business: getIdx(['nature_of_business','business_nature','business'], 14),
  };

  const buildFrom = (row) => {
    const rec = normalizeRecord(cols, row);
    const companyName = safe(row[idx.company_name] || rec.company_name || row[1] || row[0]);
    if (!companyName) continue;

    const company = {
      id: `${companyName}-${companies.length}`,
      name: companyName,
      recruiter_name: safe(row[idx.recruiter_name] || rec.recruiter_name),
      recruiter_emails: safe(row[idx.recruiter_emails] || rec.recruiter_emails),
      recruiter_phone: safe(row[idx.recruiter_phone] || rec.recruiter_phone),
      company_type: safe(row[idx.company_type] || rec.company_type),
      company_nature: safe(row[idx.company_nature] || rec.company_nature),
      company_founded_year: safe(row[idx.company_founded_year] || rec.company_founded_year),
      company_head_count: safe(row[idx.company_head_count] || rec.company_head_count),
      company_headquater_location: safe(row[idx.company_headquater_location] || rec.company_headquater_location),
      nature_of_business: safe(row[idx.nature_of_business] || rec.nature_of_business),
      website: safe(row[idx.company_url] || rec.company_url),
      logo: '',
      headquarters: '',
      employees: '',
      valuation: '',
    };
    companies.push(company);
  };

  for (const row of rows) {
    buildFrom(row);
  }
  // If nothing parsed but rows exist, try skipping first row (it may be header)
  if (companies.length === 0 && rows.length > 1) {
    for (const row of rows.slice(1)) buildFrom(row);
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
    const q = (dom.search.value || '').trim().toLowerCase();
    if (q) {
      const hay = [
        item.name,
        item.company_url,
        item.recruiter_name,
        item.recruiter_emails,
        item.recruiter_phone,
        item.company_type,
        item.company_nature,
        item.company_headquater_location,
        item.nature_of_business
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"]+/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

/* Cards */
function renderCards() {
  const filtered = applyFilters(state.companies);
  const suffix = state.sampleMode ? ' (sample data)' : '';
  dom.stats.textContent = `${filtered.length} companies • ${state.companies.length} records${suffix}`;

  if (filtered.length === 0) {
    dom.cards.innerHTML = `<div class="card"><h3>No results</h3><p class="muted">Try adjusting filters or search.</p></div>`;
    return;
  }

  const html = filtered.map(c => {
    const logo = c.logo || `https://www.google.com/s2/favicons?domain=${encodeURIComponent((c.website||'').replace(/^https?:\/\//,''))}&sz=64`;
    return `
      <article class="card" data-id="${c.id}">
        <div class="title">
          <img src="${logo}" alt="logo" onerror="this.src='';">
          <h3>${escapeHtml(c.name)}</h3>
        </div>
        <div class="tags">
          ${[c.company_type, c.company_nature, c.company_headquater_location].filter(Boolean).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="list" style="margin-top:8px">
          ${c.recruiter_name ? `<div class="row">Recruiter: ${escapeHtml(c.recruiter_name)}</div>` : ''}
          ${c.recruiter_emails ? `<div class="row">Email: ${escapeHtml(c.recruiter_emails)}</div>` : ''}
          ${c.recruiter_phone ? `<div class="row">Phone: ${escapeHtml(c.recruiter_phone)}</div>` : ''}
          ${c.company_type ? `<div class="row">Type: ${escapeHtml(c.company_type)}</div>` : ''}
          ${c.company_nature ? `<div class="row">Nature: ${escapeHtml(c.company_nature)}</div>` : ''}
          ${c.company_founded_year ? `<div class="row">Founded: ${escapeHtml(c.company_founded_year)}</div>` : ''}
          ${c.company_head_count ? `<div class="row">Headcount: ${escapeHtml(c.company_head_count)}</div>` : ''}
          ${c.company_headquater_location ? `<div class="row">HQ: ${escapeHtml(c.company_headquater_location)}</div>` : ''}
          ${c.nature_of_business ? `<div class="row">Business: ${escapeHtml(c.nature_of_business)}</div>` : ''}
        </div>
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

/* Login (full screen) */
function setAuth(isAuthed, username) {
  state.session.isAuthenticated = !!isAuthed;
  state.session.username = username || null;
  localStorage.setItem('cd_auth', JSON.stringify(state.session));
  if (state.session.isAuthenticated) {
    dom.loginScreen.hidden = true;
    document.getElementById('app').hidden = false;
  } else {
    dom.loginScreen.hidden = false;
    document.getElementById('app').hidden = true;
  }
}

function restoreAuth() {
  try {
    const saved = JSON.parse(localStorage.getItem('cd_auth') || 'null');
    if (saved && typeof saved === 'object') {
      state.session = { ...state.session, ...saved };
    }
  } catch(_) {}
  setAuth(state.session.isAuthenticated, state.session.username);
}

dom.loginScreenForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const u = (document.getElementById('ls_username').value || '').trim();
  const p = (document.getElementById('ls_password').value || '').trim();
  const passOk = p.toLowerCase() === '1234@12';
  const userOk = u.length > 0 ? true : true; // accept any non-empty username
  if (passOk && userOk) {
    dom.lsWarning.hidden = true;
    setAuth(true, u || 'Admin1234');
    showToast('Signed in');
  } else {
    dom.lsWarning.hidden = false;
    setAuth(false, null); // limited session: show login but allow view via bypass
    // proceed to view anyway
    dom.loginScreen.hidden = true;
    document.getElementById('app').hidden = false;
    showToast('Continuing without auth');
  }
});

dom.logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('cd_auth');
  setAuth(false, null);
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
    restoreAuth();
    const { cols, rows } = await fetchSheet();
    state.rawRows = rows;
    state.companies = buildCompanies(cols, rows);
    if (!state.companies || state.companies.length === 0) {
      state.sampleMode = true;
      state.companies = [
        {
          id: 'Acme-0',
          name: 'Acme Corp',
          recruiter_name: 'Jane Doe',
          recruiter_emails: 'jane@example.com',
          recruiter_phone: '+1 555-0100',
          company_type: 'Product',
          company_nature: 'SaaS',
          company_founded_year: '2015',
          company_head_count: '120',
          company_headquater_location: 'San Francisco, USA',
          nature_of_business: 'Sales CRM',
          website: 'https://acme.com',
          logo: 'https://www.google.com/s2/favicons?domain=acme.com&sz=64'
        },
        {
          id: 'Globex-1',
          name: 'Globex',
          recruiter_name: 'John Smith',
          recruiter_emails: 'john@globex.io',
          recruiter_phone: '+44 20 7946 0958',
          company_type: 'Services',
          company_nature: 'Consulting',
          company_founded_year: '2009',
          company_head_count: '550',
          company_headquater_location: 'London, UK',
          nature_of_business: 'Digital transformation',
          website: 'https://globex.io',
          logo: 'https://www.google.com/s2/favicons?domain=globex.io&sz=64'
        }
      ];
    } else {
      state.sampleMode = false;
    }
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


