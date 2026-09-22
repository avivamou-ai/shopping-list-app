async function loadCatalog() {
  const { data, error } = await supabase.from('products')
    .select('*').eq('active', true)
    .order('store').order('category').order('name');
  if (error) {
    console.error(error);
    return;
  }
  renderCatalog(data);
}

function renderCatalog(items) {
  const main = document.getElementById('catalog-container');
  main.innerHTML = '';
  const grouped = {};
  for (const p of items) {
    (grouped[p.store] ??= []).push(p);
  }
  for (const store of STORE_ORDER) {
    if (!grouped[store]) continue;
    const section = document.createElement('section');
    section.className = 'store-section';
    const h2 = document.createElement('h2');
    h2.textContent = store;
    section.appendChild(h2);
    const ul = document.createElement('ul');
    ul.className = 'product-list';
    for (const p of grouped[store]) {
      ul.appendChild(buildProductRow(p));
    }
    section.appendChild(ul);
    main.appendChild(section);
  }
}

function buildProductRow(p) {
  const li = document.createElement('li');
  li.className = 'product-row';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'pname';
  nameSpan.textContent = p.name;

  const catTag = document.createElement('span');
  catTag.className = 'tag';
  catTag.textContent = p.category;

  const freqTag = document.createElement('span');
  freqTag.className = 'tag ' + (p.frequency === 'weekly' ? 'freq-weekly' : 'freq-occasional');
  freqTag.textContent = p.frequency === 'weekly' ? 'כל שבוע' : 'לא כל שבוע';

  li.append(nameSpan, catTag, freqTag);

  if (p.frequency === 'occasional' && !p.on_list) {
    const addBtn = document.createElement('button');
    addBtn.className = 'add-to-list-btn';
    addBtn.textContent = 'להוסיף לרשימה השבוע';
    addBtn.addEventListener('click', async () => {
      await supabase.from('products').update({ on_list: true }).eq('id', p.id);
      addBtn.textContent = '✓ נוסף לרשימה';
      addBtn.disabled = true;
    });
    li.appendChild(addBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = '🗑';
  delBtn.title = 'מחק מוצר';
  delBtn.addEventListener('click', async () => {
    if (!confirm('למחוק את המוצר?')) return;
    await supabase.from('products').update({ active: false }).eq('id', p.id);
    li.remove();
  });
  li.appendChild(delBtn);

  return li;
}

let addFormBound = false;

function onAuthed() {
  if (!addFormBound) {
    document.getElementById('add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-name').value.trim();
      if (!name) return;
      const frequency = document.getElementById('new-frequency').value;
      const { error } = await supabase.from('products').insert({
        name,
        category: document.getElementById('new-category').value,
        store: document.getElementById('new-store').value,
        frequency,
        on_list: frequency === 'weekly',
      });
      if (error) {
        alert('שגיאה בהוספת מוצר: ' + error.message);
        return;
      }
      document.getElementById('new-name').value = '';
      loadCatalog();
    });
    addFormBound = true;
  }
  loadCatalog();
}
