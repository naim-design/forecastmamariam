const loginScreen = document.getElementById('login-screen');
const resetScreen = document.getElementById('reset-screen');
const authError = document.getElementById('auth-error');
const resetMessage = document.getElementById('reset-message');

function setThemeIcon(){
  const light=document.documentElement.getAttribute('data-theme')==='light';
  document.getElementById('theme-toggle').textContent=light?'☀️':'🌙';
}
function toggleTheme(){
  const light=document.documentElement.getAttribute('data-theme')==='light';
  if(light){document.documentElement.removeAttribute('data-theme');localStorage.setItem('internTheme','dark');}
  else{document.documentElement.setAttribute('data-theme','light');localStorage.setItem('internTheme','light');}
  setThemeIcon();
}
document.getElementById('theme-toggle').addEventListener('click',toggleTheme);setThemeIcon();

function friendly(err){
  const m={
    'auth/invalid-email':'Format email tak sah.',
    'auth/user-not-found':'Email belum berdaftar.',
    'auth/wrong-password':'Password salah.',
    'auth/invalid-credential':'Email atau password salah.',
    'auth/too-many-requests':'Terlalu banyak percubaan. Cuba lagi sebentar.'
  };
  return m[err.code]||err.message||'Ralat tidak diketahui.';
}
function showAlert(el,msg,ok=false){el.textContent=msg;el.classList.add('show');el.classList.toggle('success',ok);}

document.getElementById('login-form').addEventListener('submit',async(e)=>{
  e.preventDefault();authError.classList.remove('show');
  const btn=e.submitter;btn.disabled=true;btn.textContent='Log masuk...';
  try{
    await auth.signInWithEmailAndPassword(document.getElementById('login-email').value.trim(),document.getElementById('login-password').value);
    location.href='app.html';
  }catch(err){showAlert(authError,friendly(err));}
  finally{btn.disabled=false;btn.textContent='Log Masuk';}
});

document.getElementById('show-reset').addEventListener('click',()=>{loginScreen.classList.remove('active');resetScreen.classList.add('active');});
document.getElementById('show-login').addEventListener('click',()=>{resetScreen.classList.remove('active');loginScreen.classList.add('active');});
document.getElementById('reset-form').addEventListener('submit',async(e)=>{
  e.preventDefault();resetMessage.classList.remove('show');
  const btn=e.submitter;btn.disabled=true;btn.textContent='Menghantar...';
  try{await auth.sendPasswordResetEmail(document.getElementById('reset-email').value.trim());showAlert(resetMessage,'Link reset dah dihantar. Semak email anda.',true);}
  catch(err){showAlert(resetMessage,friendly(err));}
  finally{btn.disabled=false;btn.textContent='Hantar Link Reset';}
});

auth.onAuthStateChanged(user=>{if(user)location.href='app.html';});
