async function ensureWeeklyOnList() {
  await supabaseClient.from('products').update({ on_list: true })
    .eq('frequency', 'weekly').eq('active', true).eq('on_list', false);
}

async function loadList() {
  await ensureWeeklyOnList();
  const { data, error } = await supabaseClient.from('products')
    .select('*').eq('active', true).eq('on_list', true)
    .order('store').order('category').order('name');
  if (error) {
    console.error(error);
    return;
  }
  render(data);
}

function render(items) {
  const main = document.getElementById('list-container');
  main.innerHTML = '';
  if (!items.length) {
    main.innerHTML = '<p class="empty">הרשימה ריקה. לכו ל<a href="catalog.html">ניהול מוצרים</a> כדי להוסיף מוצרים.</p>';
    return;
  }
  const grouped = {};
  for (const item of items) {
    (grouped[item.store] ??= {});
    (grouped[item.store][item.category] ??= []).push(item);
  }
  for (const store of STORE_ORDER) {
    if (!grouped[store]) continue;
    const section = document.createElement('section');
    section.className = 'store-section';
    const h2 = document.createElement('h2');
    h2.textContent = store;
    section.appendChild(h2);
    for (const cat of CATEGORY_ORDER) {
      if (!grouped[store][cat]) continue;
      const block = document.createElement('div');
      block.className = 'category-block';
      const h3 = document.createElement('h3');
      h3.textContent = cat;
      block.appendChild(h3);
      const ul = document.createElement('ul');
      ul.className = 'item-list';
      for (const item of grouped[store][cat]) {
        ul.appendChild(buildItemRow(item));
      }
      block.appendChild(ul);
      section.appendChild(block);
    }
    main.appendChild(section);
  }
}

function buildItemRow(item) {
  const li = document.createElement('li');
  li.className = 'item' + (item.checked ? ' checked' : '');
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = item.checked;
  cb.className = 'toggle';
  cb.addEventListener('change', () => toggleItem(item.id, cb.checked, li));
  const span = document.createElement('span');
  span.textContent = item.name;
  label.append(cb, span);
  li.appendChild(label);
  if (item.frequency === 'occasional') {
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '✕';
    btn.title = 'הסר מהרשימה';
    btn.addEventListener('click', () => removeFromList(item.id, li));
    li.appendChild(btn);
  }
  return li;
}

async function toggleItem(id, checked, li) {
  li.classList.toggle('checked', checked);
  await supabaseClient.from('products').update({ checked }).eq('id', id);
}

async function removeFromList(id, li) {
  li.remove();
  await supabaseClient.from('products').update({ on_list: false, checked: false }).eq('id', id);
}

async function finishShopping() {
  if (!confirm('לסיים קנייה ולנקות את הרשימה?')) return;
  await supabaseClient.from('products').update({ checked: false }).eq('frequency', 'weekly');
  await supabaseClient.from('products').update({ on_list: false, checked: false }).eq('frequency', 'occasional');
  loadList();
}

async function compareBasketCost() {
  const resultsEl = document.getElementById('compare-results');
  resultsEl.innerHTML = '<p class="empty">מחשב...</p>';

  const { data: listItems, error: listErr } = await supabaseClient
    .from('products')
    .select('barcode')
    .eq('active', true).eq('on_list', true).not('barcode', 'is', null);
  if (listErr) {
    resultsEl.innerHTML = `<p class="empty">שגיאה: ${listErr.message}</p>`;
    return;
  }

  const barcodes = [...new Set(listItems.map((i) => i.barcode))];
  if (!barcodes.length) {
    resultsEl.innerHTML = '<p class="empty">אין ברשימה כרגע מוצרים עם ברקוד מקושר (הוסיפו מוצרים דרך <a href="search.html">חיפוש</a>).</p>';
    return;
  }

  const { data: priceRows, error: priceErr } = await supabaseClient
    .from('prices')
    .select('chain, barcode, price')
    .in('barcode', barcodes);
  if (priceErr) {
    resultsEl.innerHTML = `<p class="empty">שגיאה: ${priceErr.message}</p>`;
    return;
  }

  const totals = {};
  for (const row of priceRows) {
    const t = (totals[row.chain] ??= { total: 0, barcodes: new Set() });
    if (!t.barcodes.has(row.barcode)) {
      t.barcodes.add(row.barcode);
      t.total += row.price;
    }
  }

  const ranked = Object.keys(totals)
    .map((chain) => ({ chain, total: totals[chain].total, count: totals[chain].barcodes.size }))
    .sort((a, b) => a.total - b.total);

  resultsEl.innerHTML = '';
  if (!ranked.length) {
    resultsEl.innerHTML = '<p class="empty">לא נמצאו מחירים עדכניים למוצרים האלה.</p>';
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'item-list';
  ranked.forEach((r, idx) => {
    const li = document.createElement('li');
    li.className = 'item';
    const span = document.createElement('span');
    span.textContent = `${r.chain} — ₪${r.total.toFixed(2)} (${r.count}/${barcodes.length} מוצרים נמצאו)`;
    if (idx === 0) span.style.fontWeight = 'bold';
    li.appendChild(span);
    ul.appendChild(li);
  });
  resultsEl.appendChild(ul);
}

let listButtonsBound = false;

function onAuthed() {
  if (!listButtonsBound) {
    document.getElementById('finish-btn').addEventListener('click', finishShopping);
    document.getElementById('compare-btn').addEventListener('click', compareBasketCost);
    listButtonsBound = true;
  }
  loadList();
}
