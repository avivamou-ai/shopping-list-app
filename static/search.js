async function runSearch(query) {
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<p class="empty">מחפש...</p>';

  const { data, error } = await supabaseClient
    .from('prices')
    .select('*')
    .ilike('item_name', `%${query}%`)
    .order('item_name')
    .limit(300);

  if (error) {
    resultsEl.innerHTML = `<p class="empty">שגיאה בחיפוש: ${error.message}</p>`;
    return;
  }

  if (!data.length) {
    resultsEl.innerHTML = '<p class="empty">לא נמצאו מוצרים תואמים.</p>';
    return;
  }

  const groups = {};
  for (const row of data) {
    (groups[row.barcode] ??= { name: row.item_name, offers: [] }).offers.push(row);
  }

  resultsEl.innerHTML = '';
  for (const barcode of Object.keys(groups)) {
    const group = groups[barcode];
    group.offers.sort((a, b) => a.price - b.price);
    resultsEl.appendChild(buildProductGroup(barcode, group));
  }
}

function buildProductGroup(barcode, group) {
  const section = document.createElement('section');
  section.className = 'store-section';

  const h2 = document.createElement('h2');
  h2.textContent = group.name;
  section.appendChild(h2);

  const ul = document.createElement('ul');
  ul.className = 'item-list';
  group.offers.forEach((offer, idx) => {
    const li = document.createElement('li');
    li.className = 'item';
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = `${offer.chain} — ₪${offer.price.toFixed(2)}`;
    if (idx === 0) span.style.fontWeight = 'bold';
    label.appendChild(span);
    li.appendChild(label);
    ul.appendChild(li);
  });
  section.appendChild(ul);

  const addBtn = document.createElement('button');
  addBtn.className = 'add-to-list-btn';
  addBtn.textContent = 'הוסף לקטלוג האישי';
  addBtn.addEventListener('click', () => openAddForm(section, barcode, group));
  section.appendChild(addBtn);

  return section;
}

function openAddForm(container, barcode, group) {
  if (container.querySelector('.add-form')) return;

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
    if (s === group.offers[0].chain) opt.selected = true;
    storeSelect.appendChild(opt);
  }

  const freqSelect = document.createElement('select');
  freqSelect.innerHTML = '<option value="weekly">כל שבוע</option><option value="occasional">לא כל שבוע</option>';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = '✓ הוסף';

  form.append(categorySelect, storeSelect, freqSelect, submitBtn);
  container.appendChild(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const frequency = freqSelect.value;
    const { error } = await supabaseClient.from('products').insert({
      name: group.name,
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
