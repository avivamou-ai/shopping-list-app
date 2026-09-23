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

let finishBtnBound = false;

function onAuthed() {
  if (!finishBtnBound) {
    document.getElementById('finish-btn').addEventListener('click', finishShopping);
    finishBtnBound = true;
  }
  loadList();
}
