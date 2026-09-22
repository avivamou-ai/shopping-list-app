if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

function showApp() {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app-screen').hidden = false;
}

function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('app-screen').hidden = true;
}

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showApp();
    onAuthed();
  } else {
    showLogin();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showApp();
      onAuthed();
    } else {
      showLogin();
    }
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) errEl.textContent = 'שגיאה בהתחברות: ' + error.message;
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
});
