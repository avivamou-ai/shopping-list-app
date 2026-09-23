async function runSearch(query) {
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<p class="empty">מחפש...</p>';

  // עדיפות למוצרים שהשם שלהם מתחיל במילה שחיפשת (למשל "מלפפון") על פני
  // מוצרים שבהם המילה מופיעה בתוך שם ארוך יותר (כמו "דאודורנט בניחוח
  // מלפפון") - שניהם התאמות לגיטימיות, אבל לא באותה רלוונטיות.
  const prefixQuery = await supabaseClient
    .from('prices')
    .select('*')
    .ilike('item_name', `${query}%`)
    .order('item_name')
    .limit(300);

  if (prefixQuery.error) {
    resultsEl.innerHTML = `<p class="empty">שגיאה בחיפוש: ${prefixQuery.error.message}</p>`;
    return;
  }

  let data = prefixQuery.data;
  const seenKeys = new Set(data.map((r) => `${r.barcode}|${r.chain}`));

  if (data.length < 30) {
    const containsQuery = await supabaseClient
      .from('prices')
      .select('*')
      .ilike('item_name', `%${query}%`)
      .order('item_name')
      .limit(300);

    if (containsQuery.error) {
      resultsEl.innerHTML = `<p class="empty">שגיאה בחיפוש: ${containsQuery.error.message}</p>`;
      return;
    }

    for (const row of containsQuery.data) {
      const key = `${row.barcode}|${row.chain}`;
      if (!seenKeys.has(key)) {
        data.push(row);
        seenKeys.add(key);
      }
    }
  }

  if (!data.length) {
    resultsEl.innerHTML = '<p class="empty">לא נמצאו מוצרים תואמים.</p>';
    return;
  }

  // קבוצה לפי שם מוצר (לא ברקוד): פירות/ירקות טריים ומוצרים במשקל
  // מקבלים ברקוד/מק"ט פנימי שונה בכל רשת, אז אותו "מלפפון" מופיע עם
  // כמה ברקודים - מבחינת התצוגה זה עדיין אותו מוצר ושורה אחת.
  const products = {};
  const chainsSeen = new Set();
  for (const row of data) {
    const product = (products[row.item_name] ??= { prices: {}, barcodes: new Set() });
    if (!(row.chain in product.prices) || row.price < product.prices[row.chain]) {
      product.prices[row.chain] = row.price;
    }
    product.barcodes.add(row.barcode);
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
  for (const name of Object.keys(products)) {
    const product = products[name];
    const cheapestPrice = Math.min(...Object.values(product.prices));
    const cheapestChain = Object.keys(product.prices).find(
      (c) => product.prices[c] === cheapestPrice
    );

    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = name;
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
    addBtn.addEventListener('click', () => openAddForm(row, name, product, chains.length + 2));
    actionCell.appendChild(addBtn);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  wrapper.appendChild(table);
  return wrapper;
}

function openAddForm(productRow, name, product, colSpan) {
  const table = productRow.parentElement;
  const alreadyOpen = [...table.querySelectorAll('tr[data-form-for]')]
    .some((tr) => tr.dataset.formFor === name);
  if (alreadyOpen) return;

  const formRow = document.createElement('tr');
  formRow.dataset.formFor = name;
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
    // מוצר עם ברקוד אחד ויחיד בכל הרשתות (מוצר ארוז עם ברקוד יצרן
    // אחיד) נשמר לפי הברקוד הזה. מוצרים במשקל (פירות/ירקות טריים)
    // מקבלים מק"ט שונה בכל רשת - עבורם שומרים רק את השם, וההשוואה
    // העתידית תתאים לפי שם המוצר במקום ברקוד ספציפי.
    const barcode = product.barcodes.size === 1 ? [...product.barcodes][0] : null;
    // אין קיבוע לחנות - איפה הכי זול נקבע דינמית לפי המחירים העדכניים,
    // לא בזמן ההוספה לקטלוג
    const { error } = await supabaseClient.from('products').insert({
      name,
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
