const PAGE_SIZE = 50;
let currentPage = 0;
let currentStore = null;

function populateStoreSelect() {
  const select = document.getElementById('browse-store');
  for (const chain of PRICE_CHAINS) {
    const opt = document.createElement('option');
    opt.value = chain;
    opt.textContent = chain;
    select.appendChild(opt);
  }
}

async function loadPage() {
  const summaryEl = document.getElementById('browse-summary');
  const resultsEl = document.getElementById('browse-results');
  const pagerEl = document.getElementById('browse-pager');
  summaryEl.textContent = 'טוען...';
  resultsEl.innerHTML = '';
  pagerEl.innerHTML = '';

  const from = currentPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabaseClient
    .from('prices')
    .select('*', { count: 'exact' })
    .eq('chain', currentStore)
    .order('item_name')
    .range(from, to);

  if (error) {
    summaryEl.textContent = 'שגיאה: ' + error.message;
    return;
  }

  const totalCount = count ?? data.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  summaryEl.textContent = `${currentStore} — ${totalCount} מוצרים (עמוד ${currentPage + 1} מתוך ${totalPages})`;

  resultsEl.appendChild(buildTable(data));
  renderPager(totalPages);
}

function buildTable(rows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  const table = document.createElement('table');
  table.className = 'price-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th')).textContent = 'מוצר';
  headRow.appendChild(document.createElement('th')).textContent = 'מחיר';
  headRow.appendChild(document.createElement('th'));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = row.item_name;
    tr.appendChild(nameCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = `₪${row.price.toFixed(2)}`;
    tr.appendChild(priceCell);

    const actionCell = document.createElement('td');
    const addBtn = document.createElement('button');
    addBtn.className = 'add-to-list-btn';
    addBtn.textContent = 'הוסף';
    addBtn.addEventListener('click', () => openAddForm(tr, row));
    actionCell.appendChild(addBtn);
    tr.appendChild(actionCell);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function renderPager(totalPages) {
  const pagerEl = document.getElementById('browse-pager');
  pagerEl.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'pager-btn';
  prevBtn.textContent = '‹ הקודם';
  prevBtn.disabled = currentPage === 0;
  prevBtn.addEventListener('click', () => {
    currentPage -= 1;
    loadPage();
  });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'pager-btn';
  nextBtn.textContent = 'הבא ›';
  nextBtn.disabled = currentPage >= totalPages - 1;
  nextBtn.addEventListener('click', () => {
    currentPage += 1;
    loadPage();
  });

  pagerEl.append(prevBtn, nextBtn);
}

async function openAddForm(productRow, priceRow) {
  const table = productRow.parentElement;
  const alreadyOpen = [...table.querySelectorAll('tr[data-form-for]')]
    .some((tr) => tr.dataset.formFor === priceRow.item_name);
  if (alreadyOpen) return;

  // בדיקה אם לשם המוצר הזה יש ברקוד אחיד בכל הרשתות, או שכל רשת
  // משתמשת במק"ט פנימי משלה (מוצר במשקל) - ר' static/search.js
  const { data: sameName } = await supabaseClient
    .from('prices').select('barcode').eq('item_name', priceRow.item_name);
  const distinctBarcodes = new Set((sameName && sameName.length ? sameName : [priceRow]).map((r) => r.barcode));
  const barcode = distinctBarcodes.size === 1 ? [...distinctBarcodes][0] : null;

  const formRow = document.createElement('tr');
  formRow.dataset.formFor = priceRow.item_name;
  const cell = document.createElement('td');
  cell.colSpan = 3;

  const form = document.createElement('form');
  form.className = 'add-form';

  const categorySelect = document.createElement('select');
  for (const c of CATEGORY_ORDER) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  }

  const freqSelect = document.createElement('select');
  freqSelect.innerHTML = '<option value="weekly">כל שבוע</option><option value="occasional">לא כל שבוע</option>';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = '✓ הוסף לקטלוג';

  form.append(categorySelect, freqSelect, submitBtn);
  cell.appendChild(form);
  formRow.appendChild(cell);
  productRow.after(formRow);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const frequency = freqSelect.value;
    const { error } = await supabaseClient.from('products').insert({
      name: priceRow.item_name,
      barcode,
      category: categorySelect.value,
      store: 'כל חנות',
      frequency,
      on_list: frequency === 'weekly',
    });
    if (error) {
      alert('שגיאה בהוספה: ' + error.message);
      return;
    }
    submitBtn.textContent = '✓ נוסף לקטלוג';
    submitBtn.disabled = true;
    categorySelect.disabled = true;
    freqSelect.disabled = true;
  });
}

let browseFormBound = false;

function onAuthed() {
  if (!browseFormBound) {
    populateStoreSelect();
    document.getElementById('browse-form').addEventListener('submit', (e) => {
      e.preventDefault();
      currentStore = document.getElementById('browse-store').value;
      currentPage = 0;
      loadPage();
    });
    browseFormBound = true;
    currentStore = PRICE_CHAINS[0];
    loadPage();
  }
}
