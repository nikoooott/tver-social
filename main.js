import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

const state = { user:null, profile:null, page:'home', search:'', posts:[], people:[], notifications:[], modal:null, editingProfile:false, selectedPost:null }
const app = document.querySelector('#app')

const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const timeAgo = d => { const sec=Math.max(1,(Date.now()-new Date(d))/1000); if(sec<60)return `${Math.floor(sec)}с`; if(sec<3600)return `${Math.floor(sec/60)}м`; if(sec<86400)return `${Math.floor(sec/3600)}ч`; if(sec<604800)return `${Math.floor(sec/86400)}д`; return new Date(d).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) }
const initials = name => esc((name||'?').trim().slice(0,1).toUpperCase())
const avatar = (p,size='md') => p?.avatar_url ? `<img class="avatar ${size}" src="${esc(p.avatar_url)}" alt="">` : `<div class="avatar ${size} avatar-fallback">${initials(p?.display_name||p?.username)}</div>`
const toast = (msg,type='ok') => { const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),3200) }

function shell(){
  app.innerHTML = `<div class="app-shell">
    <header class="topbar"><div class="topbar-inner">
      <button class="brand" data-nav="home"><span class="brand-mark">Т</span><span>ТВЕРЬ <b>Social</b></span></button>
      <div class="global-search"><span>⌕</span><input id="globalSearch" value="${esc(state.search)}" placeholder="Поиск людей и публикаций"/></div>
      <nav class="desktop-nav">
        <button data-nav="home" class="nav-btn ${state.page==='home'?'active':''}">Главная</button>
        <button data-nav="people" class="nav-btn ${state.page==='people'?'active':''}">Люди</button>
        ${state.user?`<button data-nav="notifications" class="nav-btn ${state.page==='notifications'?'active':''}">Уведомления ${state.notifications.filter(n=>!n.read_at).length?`<i>${state.notifications.filter(n=>!n.read_at).length}</i>`:''}</button>`:''}
      </nav>
      <div class="top-actions">${state.user?`<button class="profile-chip" data-action="profile">${avatar(state.profile,'sm')}<span>${esc(state.profile?.display_name||state.profile?.username)}</span></button><button class="icon-btn" data-action="logout" title="Выйти">↪</button>`:`<button class="btn primary small" data-action="auth">Войти</button>`}</div>
    </div></header>
    <main id="main"></main>
    <button class="mobile-create" data-action="new-post">＋</button>
  </div>`
  bindShell()
}

function bindShell(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{state.page=b.dataset.nav; state.search=''; renderPage()})
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>actions(b.dataset.action))
  const search=document.querySelector('#globalSearch'); if(search){ search.onkeydown=e=>{if(e.key==='Enter'){state.search=search.value.trim(); state.page='search'; renderPage()}} }
}

async function renderPage(){ shell(); const main=document.querySelector('#main'); main.innerHTML='<div class="loading"><span></span><span></span><span></span></div>'; if(!supabase){main.innerHTML=setupView();return}
  if(state.page==='home') await homeView(main)
  else if(state.page==='people') await peopleView(main)
  else if(state.page==='search') await searchView(main)
  else if(state.page==='notifications') await notificationsView(main)
  else if(state.page==='profile') await profileView(main,state.user.id)
  else if(state.page.startsWith('user:')) await profileView(main,state.page.slice(5))
  else await homeView(main)
  bindPage()
}

function setupView(){return `<div class="empty-page"><div class="empty-icon">⚙</div><h1>Подключи Supabase</h1><p>Добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Vercel.</p></div>`}
function bindPage(){ document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>actions(b.dataset.action)); document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{state.page=b.dataset.nav;renderPage()}); document.querySelectorAll('[data-post]').forEach(b=>b.onclick=()=>openPost(b.dataset.post)); document.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>{state.page='user:'+b.dataset.user;renderPage()}); }

async function homeView(main){
  const {data:posts,error}=await supabase.from('posts').select('*, profiles(*)').order('created_at',{ascending:false}).limit(50)
  if(error){main.innerHTML=errorView(error.message);return}
  state.posts=posts||[]
  main.innerHTML=`<div class="page-grid"><section class="feed-column">
    <div class="hero-card"><div><span class="eyebrow">ГОРОДСКАЯ СОЦСЕТЬ</span><h1>Тверь в одном месте.</h1><p>Люди, фотографии и события твоего города.</p></div>${state.user?`<button class="btn white" data-action="new-post">＋ Опубликовать</button>`:`<button class="btn white" data-action="auth">Присоединиться</button>`}</div>
    ${state.user?await composerMini():''}
    <div class="section-head"><div><h2>Последние публикации</h2><p>Что происходит в Твери прямо сейчас</p></div><button class="ghost" data-action="refresh">Обновить ↻</button></div>
    ${posts?.length?posts.map(postCard).join(''):`<div class="empty-card"><div class="empty-icon">✦</div><h3>Лента пока пустая</h3><p>Стань первым, кто опубликует фотографию или историю Твери.</p>${state.user?`<button class="btn primary" data-action="new-post">Создать публикацию</button>`:''}</div>`}
  </section><aside class="side-column">${await sidebar()}</aside></div>`
}

async function composerMini(){return `<div class="mini-composer" data-action="new-post"><div>${avatar(state.profile,'sm')}</div><div class="composer-placeholder">Что нового в Твери?</div><button class="icon-btn">＋</button></div>`}
async function sidebar(){
  const {data:people}=await supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(5)
  return `<div class="side-card"><span class="eyebrow">ТВЕРЬ SOCIAL</span><h3>Люди рядом</h3><p class="muted">Новые участники города</p>${(people||[]).filter(p=>p.id!==state.user?.id).map(p=>`<button class="person-row" data-user="${p.id}">${avatar(p,'sm')}<span><b>${esc(p.display_name)}</b><small>@${esc(p.username)}</small></span></button>`).join('')||'<p class="muted">Пока никого нет.</p>'}</div><div class="side-card"><span class="eyebrow">ПРАВИЛА</span><h3>Тверь — без лишнего шума.</h3><p class="muted">Публикуй свои фото, знакомься с людьми города и уважай других участников.</p></div>`
}

function postCard(p){
  const prof=p.profiles||{}; return `<article class="post-card" data-post="${p.id}"><div class="post-head"><button class="user-line" data-user="${p.user_id}">${avatar(prof,'md')}<span><b>${esc(prof.display_name||'Пользователь')}</b><small>@${esc(prof.username||'user')} · ${timeAgo(p.created_at)}</small></span></button>${state.user?.id===p.user_id?`<button class="icon-btn" data-action="post-menu" data-id="${p.id}">•••</button>`:''}</div>${p.text?`<p class="post-text">${esc(p.text).replace(/\n/g,'<br>')}</p>`:''}${p.image_url?`<img class="post-image" loading="lazy" src="${esc(p.image_url)}" alt="Публикация"/>`:''}<div class="post-actions"><button data-action="like" data-id="${p.id}">♡ <span id="likes-${p.id}">...</span></button><button data-action="comments" data-id="${p.id}">◯ Комментарии</button><button data-action="bookmark" data-id="${p.id}">⌑</button></div></article>`
}

async function hydratePostStats(){
  for(const p of state.posts){ const [{count:likes},{count:comments},{data:mineLike},{data:mineBookmark}]=await Promise.all([
    supabase.from('likes').select('*',{count:'exact',head:true}).eq('post_id',p.id),
    supabase.from('comments').select('*',{count:'exact',head:true}).eq('post_id',p.id),
    state.user?supabase.from('likes').select('post_id').eq('post_id',p.id).eq('user_id',state.user.id):Promise.resolve({data:[]}),
    state.user?supabase.from('bookmarks').select('post_id').eq('post_id',p.id).eq('user_id',state.user.id):Promise.resolve({data:[]})
  ]); const el=document.querySelector(`#likes-${p.id}`); if(el) el.textContent=likes||0; const b=document.querySelector(`[data-action="like"][data-id="${p.id}"]`); if(b) b.classList.toggle('liked',!!mineLike?.length); const bm=document.querySelector(`[data-action="bookmark"][data-id="${p.id}"]`); if(bm) bm.classList.toggle('saved',!!mineBookmark?.length); const c=document.querySelector(`[data-action="comments"][data-id="${p.id}"]`); if(c)c.textContent=`◯ ${comments||0}` }
}

async function peopleView(main){ const {data:people,error}=await supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(100); if(error){main.innerHTML=errorView(error.message);return} state.people=people||[]; main.innerHTML=`<div class="center-page"><div class="section-head"><div><span class="eyebrow">СООБЩЕСТВО</span><h1>Люди Твери</h1><p>Знакомься и подписывайся.</p></div></div><div class="people-grid">${state.people.map(p=>`<article class="person-card"><button data-user="${p.id}" class="person-main">${avatar(p,'lg')}<h3>${esc(p.display_name)}</h3><p>@${esc(p.username)}</p>${p.age?`<small>${p.age} лет</small>`:''}${p.bio?`<div class="bio">${esc(p.bio)}</div>`:''}</button>${state.user&&state.user.id!==p.id?`<button class="btn ${'follow'}" data-action="follow" data-id="${p.id}">Подписаться</button>`:''}</article>`).join('')||`<div class="empty-card">Пока нет пользователей.</div>`}</div></div>` }

async function searchView(main){ const q=state.search; if(!q){state.page='home';return renderPage()} const [{data:people},{data:posts}]=await Promise.all([supabase.from('profiles').select('*').or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(30),supabase.from('posts').select('*, profiles(*)').ilike('text',`%${q}%`).limit(30)]); main.innerHTML=`<div class="center-page"><div class="section-head"><div><span class="eyebrow">ПОИСК</span><h1>Результаты для «${esc(q)}»</h1></div></div><h2>Люди</h2><div class="people-grid compact">${(people||[]).map(p=>`<article class="person-card"><button class="person-main" data-user="${p.id}">${avatar(p,'lg')}<h3>${esc(p.display_name)}</h3><p>@${esc(p.username)}</p></button></article>`).join('')||'<p class="muted">Людей не найдено.</p>'}</div><h2 class="mt">Публикации</h2>${(posts||[]).map(postCard).join('')||'<p class="muted">Публикаций не найдено.</p>'}</div>` }

async function notificationsView(main){ if(!state.user){main.innerHTML=authRequired();return} const {data,error}=await supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(*), post:posts(*)').order('created_at',{ascending:false}).limit(50); if(error){main.innerHTML=errorView(error.message);return} state.notifications=data||[]; main.innerHTML=`<div class="center-page narrow"><div class="section-head"><div><span class="eyebrow">УВЕДОМЛЕНИЯ</span><h1>Твои новости</h1></div><button class="ghost" data-action="read-notifications">Отметить прочитанными</button></div><div class="notification-list">${state.notifications.map(n=>`<button class="notification ${n.read_at?'':'unread'}" data-post="${n.post_id||''}">${avatar(n.actor,'sm')}<span>${n.type==='like'?'❤️':n.type==='comment'?'💬':'👤'} <b>${esc(n.actor?.display_name||'Пользователь')}</b> ${n.type==='like'?'поставил(а) лайк твоей публикации':n.type==='comment'?'прокомментировал(а) твою публикацию':'подписался(ась) на тебя'}<small>${timeAgo(n.created_at)}</small></span></button>`).join('')||'<div class="empty-card">Пока нет уведомлений.</div>'}</div></div>` }

async function profileView(main,id){ const {data:p,error}=await supabase.from('profiles').select('*').eq('id',id).single(); if(error){main.innerHTML=errorView(error.message);return} const [{data:posts},{count:followers},{count:following},{data:follow}]=await Promise.all([supabase.from('posts').select('*, profiles(*)').eq('user_id',id).order('created_at',{ascending:false}),supabase.from('follows').select('*',{count:'exact',head:true}).eq('following_id',id),supabase.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',id),state.user&&state.user.id!==id?supabase.from('follows').select('*').eq('follower_id',state.user.id).eq('following_id',id):Promise.resolve({data:[]})]); main.innerHTML=`<div class="center-page"><section class="profile-hero"><div>${avatar(p,'xl')}</div><div class="profile-info"><span class="eyebrow">ПРОФИЛЬ</span><h1>${esc(p.display_name)}</h1><p class="handle">@${esc(p.username)} ${p.age?`· ${p.age}`:''}</p><p>${esc(p.bio||'Пока нет описания.')}</p><div class="stats"><b>${posts?.length||0}<small>публикаций</small></b><b>${followers||0}<small>подписчиков</small></b><b>${following||0}<small>подписок</small></b></div></div><div class="profile-actions">${state.user?.id===id?`<button class="btn primary" data-action="edit-profile">Редактировать</button>`:`<button class="btn ${follow?.length?'secondary':'primary'}" data-action="follow" data-id="${id}">${follow?.length?'Вы подписаны':'Подписаться'}</button>`}</div></section><div class="profile-tabs"><span>Публикации</span></div><div class="profile-feed">${posts?.map(postCard).join('')||'<div class="empty-card">Публикаций пока нет.</div>'}</div></div>` }

function authRequired(){return `<div class="empty-page"><div class="empty-icon">◌</div><h1>Нужен аккаунт</h1><p>Войди или зарегистрируйся, чтобы пользоваться этой функцией.</p><button class="btn primary" data-action="auth">Войти</button></div>`}
function errorView(msg){return `<div class="empty-page"><div class="empty-icon">!</div><h1>Что-то пошло не так</h1><p>${esc(msg)}</p><button class="btn secondary" data-action="refresh">Повторить</button></div>`}

function openAuth(){ state.modal='auth'; renderModal(); }
function renderModal(){
  const old=document.querySelector('.modal-layer'); old?.remove(); if(!state.modal)return;
  let content='';
  if(state.modal==='auth') content=`<div class="modal-card auth-card"><button class="modal-close" data-action="close-modal">×</button><span class="eyebrow">ТВЕРЬ SOCIAL</span><h2>Войти в Тверь</h2><p class="muted">Общайся с людьми своего города.</p><div class="tabs"><button class="tab active" data-authmode="login">Вход</button><button class="tab" data-authmode="register">Регистрация</button></div><form id="authForm"><div class="field"><label>Email</label><input id="email" type="email" required placeholder="you@example.com"></div><div class="field"><label>Пароль</label><input id="password" type="password" required minlength="6" placeholder="Минимум 6 символов"></div><div id="registerFields" class="hidden"><div class="field"><label>Никнейм</label><input id="username" maxlength="24" placeholder="niko"></div><div class="field"><label>Имя</label><input id="displayName" maxlength="40" placeholder="Нико"></div><div class="field"><label>Возраст</label><input id="age" type="number" min="13" max="120" placeholder="18"></div></div><button class="btn primary full" type="submit">Продолжить</button><p id="authMsg" class="form-msg"></p></form></div>`;
  if(state.modal==='new-post') content=`<div class="modal-card post-modal"><button class="modal-close" data-action="close-modal">×</button><span class="eyebrow">НОВАЯ ПУБЛИКАЦИЯ</span><h2>Что нового в Твери?</h2><form id="postForm"><div class="upload-box" id="uploadBox"><input id="postFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><div class="upload-icon">＋</div><b>Добавить фотографию</b><span>JPG, PNG, WEBP до 10 МБ</span><img id="preview" class="preview hidden"></div><div class="field"><textarea id="postText" maxlength="2000" rows="5" placeholder="Расскажи, что происходит..."></textarea></div><div class="modal-row"><span id="uploadStatus" class="muted">Можно опубликовать и без фото</span><button class="btn primary" type="submit">Опубликовать</button></div></form></div>`;
  if(state.modal==='edit-profile') content=`<div class="modal-card"><button class="modal-close" data-action="close-modal">×</button><span class="eyebrow">ПРОФИЛЬ</span><h2>Редактировать профиль</h2><form id="profileForm"><div class="upload-box avatar-upload"><input id="avatarFile" type="file" accept="image/*">${avatar(state.profile,'xl')}<b>Изменить аватар</b></div><div class="field"><label>Имя</label><input id="pName" maxlength="40" value="${esc(state.profile.display_name)}"></div><div class="field"><label>Никнейм</label><input id="pUsername" maxlength="24" value="${esc(state.profile.username)}"></div><div class="field"><label>Возраст</label><input id="pAge" type="number" min="13" max="120" value="${state.profile.age||''}"></div><div class="field"><label>О себе</label><textarea id="pBio" maxlength="160" rows="4">${esc(state.profile.bio||'')}</textarea></div><button class="btn primary full" type="submit">Сохранить</button><p id="profileMsg" class="form-msg"></p></form></div>`;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-layer">${content}</div>`); bindModal();
}

function bindModal(){
  document.querySelectorAll('.modal-layer [data-action]').forEach(b=>b.onclick=()=>actions(b.dataset.action));
  document.querySelectorAll('[data-authmode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-authmode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector('#registerFields').classList.toggle('hidden',b.dataset.authmode!=='register');document.querySelector('#authForm').dataset.mode=b.dataset.authmode})
  const form=document.querySelector('#authForm'); if(form) form.onsubmit=submitAuth;
  const file=document.querySelector('#postFile'); if(file) file.onchange=()=>previewFile(file,'#preview'); const pf=document.querySelector('#postForm'); if(pf) pf.onsubmit=submitPost;
  const af=document.querySelector('#avatarFile'); if(af) af.onchange=()=>previewFile(af,null); const ef=document.querySelector('#profileForm'); if(ef) ef.onsubmit=submitProfile;
}

async function submitAuth(e){e.preventDefault(); const f=e.currentTarget, mode=f.dataset.mode||'login', msg=document.querySelector('#authMsg'); msg.textContent=''; const email=document.querySelector('#email').value.trim(), password=document.querySelector('#password').value; if(mode==='register'){const username=document.querySelector('#username').value.trim().toLowerCase(), display_name=document.querySelector('#displayName').value.trim(), age=Number(document.querySelector('#age').value); if(!/^[a-zа-яё0-9_.]{3,24}$/i.test(username))return msg.textContent='Никнейм: 3–24 символа, буквы, цифры, _ или .'; if(age<13)return msg.textContent='Регистрация доступна с 13 лет.'; const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username,display_name,age}}}); if(error)return msg.textContent=error.message; if(!data.session){msg.textContent='Аккаунт создан. Проверь почту и подтверди регистрацию.';return} state.user=data.user; await loadProfile(); state.modal=null; renderPage(); } else {const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error)return msg.textContent=error.message; state.user=data.user; await loadProfile(); state.modal=null; renderPage();}}

function previewFile(fileInput, selector){ const file=fileInput.files?.[0]; if(!file)return; if(file.size>10*1024*1024){toast('Фото больше 10 МБ','error');fileInput.value='';return} if(selector){const img=document.querySelector(selector);img.src=URL.createObjectURL(file);img.classList.remove('hidden')} }
async function uploadFile(file,bucket){ const path=`${state.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`; const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type}); if(error)throw error; return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl }
async function submitPost(e){e.preventDefault(); if(!state.user)return; const btn=e.submitter; btn.disabled=true; const status=document.querySelector('#uploadStatus'); try{const text=document.querySelector('#postText').value.trim(), file=document.querySelector('#postFile').files?.[0]; if(!text&&!file)throw new Error('Добавь текст или фотографию.'); let image_url=null; if(file){status.textContent='Загружаем фотографию…';image_url=await uploadFile(file,'post-images')} status.textContent='Публикуем…'; const {error}=await supabase.from('posts').insert({user_id:state.user.id,text,image_url}); if(error)throw error; toast('Публикация опубликована'); state.modal=null; renderPage()}catch(err){status.textContent=err.message;toast(err.message,'error')}finally{btn.disabled=false}}
async function submitProfile(e){e.preventDefault(); const msg=document.querySelector('#profileMsg'); const updates={display_name:document.querySelector('#pName').value.trim(),username:document.querySelector('#pUsername').value.trim().toLowerCase(),age:Number(document.querySelector('#pAge').value)||null,bio:document.querySelector('#pBio').value.trim()}; try{const file=document.querySelector('#avatarFile').files?.[0]; if(file)updates.avatar_url=await uploadFile(file,'avatars'); const {error}=await supabase.from('profiles').update(updates).eq('id',state.user.id); if(error)throw error; await loadProfile(); state.modal=null; renderPage(); toast('Профиль сохранён')}catch(err){msg.textContent=err.message}}

async function openPost(id){ const {data:p}=await supabase.from('posts').select('*, profiles(*)').eq('id',id).single(); if(!p)return; const {data:comments}=await supabase.from('comments').select('*, profiles(*)').eq('post_id',id).order('created_at',{ascending:true}); state.modal='post:'+id; document.body.insertAdjacentHTML('beforeend',`<div class="modal-layer"><div class="modal-card comments-modal"><button class="modal-close" data-action="close-modal">×</button>${postCard(p)}<div class="comments"><h3>Комментарии</h3>${(comments||[]).map(c=>`<div class="comment"><button data-user="${c.user_id}">${avatar(c.profiles,'sm')}</button><div><b>${esc(c.profiles?.display_name||'Пользователь')}</b><small>${timeAgo(c.created_at)}</small><p>${esc(c.text)}</p></div></div>`).join('')||'<p class="muted">Будь первым в комментариях.</p>'}</div>${state.user?`<form id="commentForm" class="comment-form"><input id="commentText" maxlength="500" placeholder="Написать комментарий…"><button class="btn primary">Отправить</button></form>`:''}</div></div>`); document.querySelectorAll('.modal-layer [data-action]').forEach(b=>b.onclick=()=>actions(b.dataset.action));document.querySelectorAll('.modal-layer [data-user]').forEach(b=>b.onclick=()=>{state.modal=null;state.page='user:'+b.dataset.user;renderModal();renderPage()}); const cf=document.querySelector('#commentForm');if(cf)cf.onsubmit=async e=>{e.preventDefault();const text=document.querySelector('#commentText').value.trim();if(!text)return;const {error}=await supabase.from('comments').insert({post_id:id,user_id:state.user.id,text});if(error)toast(error.message,'error');else{state.modal=null;openPost(id)}} }

async function actions(a){
  if(a==='auth'){openAuth();return} if(a==='close-modal'){state.modal=null;document.querySelector('.modal-layer')?.remove();return} if(a==='new-post'){if(!state.user)return openAuth();state.modal='new-post';renderModal();return} if(a==='edit-profile'){state.modal='edit-profile';renderModal();return} if(a==='profile'){state.page='profile';renderPage();return} if(a==='logout'){await supabase.auth.signOut();state.user=null;state.profile=null;state.page='home';renderPage();return} if(a==='refresh'){renderPage();return}
  if(a==='like'){if(!state.user)return openAuth();const id=document.querySelector(`[data-action="like"][data-id="${a.id}"]`)?.dataset.id||event?.currentTarget?.dataset.id;return}
}

// Delegate data-id actions robustly because buttons are dynamically rendered.
document.addEventListener('click', async e=>{
  const b=e.target.closest('[data-action]'); if(!b)return; const a=b.dataset.action, id=b.dataset.id;
  if(['like','bookmark','follow','comments','post-menu','read-notifications'].includes(a)) e.stopPropagation();
  if(a==='like'){ if(!state.user)return openAuth(); const {data:mine}=await supabase.from('likes').select('post_id').eq('post_id',id).eq('user_id',state.user.id); if(mine?.length) await supabase.from('likes').delete().eq('post_id',id).eq('user_id',state.user.id); else await supabase.from('likes').insert({post_id:id,user_id:state.user.id}); const {count}=await supabase.from('likes').select('*',{count:'exact',head:true}).eq('post_id',id);const el=document.querySelector(`#likes-${id}`);if(el)el.textContent=count||0;b.classList.toggle('liked',!mine?.length);return}
  if(a==='bookmark'){if(!state.user)return openAuth();const {data:mine}=await supabase.from('bookmarks').select('post_id').eq('post_id',id).eq('user_id',state.user.id);if(mine?.length)await supabase.from('bookmarks').delete().eq('post_id',id).eq('user_id',state.user.id);else await supabase.from('bookmarks').insert({post_id:id,user_id:state.user.id});b.classList.toggle('saved',!mine?.length);toast(mine?.length?'Удалено из закладок':'Сохранено');return}
  if(a==='comments'){openPost(id);return}
  if(a==='follow'){if(!state.user)return openAuth();const {data:mine}=await supabase.from('follows').select('*').eq('follower_id',state.user.id).eq('following_id',id);if(mine?.length)await supabase.from('follows').delete().eq('follower_id',state.user.id).eq('following_id',id);else await supabase.from('follows').insert({follower_id:state.user.id,following_id:id});toast(mine?.length?'Подписка отменена':'Ты подписался');renderPage();return}
  if(a==='read-notifications'){await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',state.user.id).is('read_at',null);renderPage();return}
  if(a==='post-menu'){if(confirm('Удалить публикацию?')){await supabase.from('posts').delete().eq('id',id).eq('user_id',state.user.id);toast('Публикация удалена');renderPage()}return}
})

async function loadProfile(){if(!state.user)return;const {data}=await supabase.from('profiles').select('*').eq('id',state.user.id).single();state.profile=data}

async function boot(){ if(!supabase){renderPage();return} const {data:{session}}=await supabase.auth.getSession(); state.user=session?.user||null; if(state.user)await loadProfile(); await renderPage(); supabase.auth.onAuthStateChange(async(_e,s)=>{state.user=s?.user||null;if(state.user)await loadProfile();}) }
boot()
