async function postJSON(url, data) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {}),
  });
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('new-name').value.trim();
  if (!name) return;
  await postJSON('/api/products', {
    name,
    category: document.getElementById('new-category').value,
    store: document.getElementById('new-store').value,
    frequency: document.getElementById('new-frequency').value,
  });
  location.reload();
});

document.querySelectorAll('.delete-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!confirm('למחוק את המוצר?')) return;
    await postJSON(`/api/products/${btn.dataset.id}/delete`);
    btn.closest('.product-row').remove();
  });
});

document.querySelectorAll('.add-to-list-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    await postJSON(`/api/list/add/${btn.dataset.id}`);
    btn.textContent = '✓ נוסף לרשימה';
    btn.disabled = true;
  });
});
