function post(url) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
}

document.querySelectorAll('.toggle').forEach(cb => {
  cb.addEventListener('change', async () => {
    const id = cb.dataset.id;
    await post(`/api/list/toggle/${id}`);
    cb.closest('.item').classList.toggle('checked', cb.checked);
  });
});

document.querySelectorAll('.remove-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    await post(`/api/list/remove/${id}`);
    btn.closest('.item').remove();
  });
});

const finishBtn = document.getElementById('finish-btn');
if (finishBtn) {
  finishBtn.addEventListener('click', async () => {
    if (!confirm('לסיים קנייה ולנקות את הרשימה?')) return;
    await post('/api/list/finish');
    location.reload();
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
