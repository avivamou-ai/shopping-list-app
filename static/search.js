async function runSearch(query) {
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<p class="empty">מחפש...</p>';

  const { data, error } = await supabaseClient
    .from('prices')
    .select('*')
    .ilike('item_name', `%${query}%`)
    .order('item_name')
    .limit(500);

  if (error) {
    resultsEl.innerHTML = `<p class="empty">שגיאה בחיפוש: ${error.message}</p>`;
    return;
  }

  if (!data.length) {
    resultsEl.innerHTML = '<p class="empty">לא נמצאו מוצרים תואמים.</p>';
    return;
  }

  const products = {};
  const chainsSeen = new Set();
  for (const row of data) {
    const product = (products[row.barcode] ??= { name: row.item_name, prices: {} });
    product.prices[row.chain] = row.price;
    chainsSeen.add(row.chain);
  }

  const chains = [...chainsSeen].sort((a, b) => {
    const ia = STORE_ORDER.indexOf(a);
    const ib = STORE_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  resultsEl.innerHTML = '';
  resultsEl.appendChild(buildPriceTable(products, chains));
}

function buildPriceTable(products, chains) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.className = 'price-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th')).textContent = 'מוצר';
  for (const chain of chains) {
    headRow.appendChild(document.createElement('th')).textContent = chain;
  }
  headRow.appendChild(document.createElement('th'));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const barcode of Object.keys(products)) {
    const product = products[barcode];
    const cheapestPrice = Math.min(...Object.values(product.prices));
    const cheapestChain = Object.keys(product.prices).find(
      (c) => product.prices[c] === cheapestPrice
    );

    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = product.name;
    row.appendChild(nameCell);

    for (const chain of chains) {
      const cell = document.createElement('td');
      if (chain in product.prices) {
        cell.textContent = `₪${product.prices[chain].toFixed(2)}`;
        if (chain === cheapestChain) cell.className = 'cheapest-cell';
      } else {
        cell.textContent = '—';
        cell.className = 'no-offer-cell';
      }
      row.appendChild(cell);
    }

    const actionCell = document.createElement('td');
    const addBtn = document.createElement('button');
    addBtn.className = 'add-to-list-btn';
    addBtn.textContent = 'הוסף';
    addBtn.addEventListener('click', () => openAddForm(row, barcode, product, cheapestChain, chains.length + 2));
    actionCell.appendChild(addBtn);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  wrapper.appendChild(table);
  return wrapper;
}

function openAddForm(productRow, barcode, product, defaultChain, colSpan) {
  const table = productRow.parentElement;
  if (table.querySelector(`tr[data-form-for="${barcode}"]`)) return;

  const formRow = document.createElement('tr');
  formRow.dataset.formFor = barcode;
  const cell = document.createElement('td');
  cell.colSpan = colSpan;

  const form = document.createElement('form');
  form.className = 'add-form';

  const categorySelect = document.createElement('select');
  for (const c of CATEGORY_ORDER) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  }

  const storeSelect = document.createElement('select');
  for (const s of STORE_ORDER) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    if (s === defaultChain) opt.selected = true;
    storeSelect.appendChild(opt);
  }

  const freqSelect = document.createElement('select');
  freqSelect.innerHTML = '<option value="weekly">כל שבוע</option><option value="occasional">לא כל שבוע</option>';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = '✓ הוסף לקטלוג';

  form.append(categorySelect, storeSelect, freqSelect, submitBtn);
  cell.appendChild(form);
  formRow.appendChild(cell);
  productRow.after(formRow);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const frequency = freqSelect.value;
    const { error } = await supabaseClient.from('products').insert({
      name: product.name,
      barcode,
      category: categorySelect.value,
      store: storeSelect.value,
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
    storeSelect.disabled = true;
    freqSelect.disabled = true;
  });
}

let searchFormBound = false;

function onAuthed() {
  if (!searchFormBound) {
    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const query = document.getElementById('search-query').value.trim();
      if (query) runSearch(query);
    });
    searchFormBound = true;
  }
}
