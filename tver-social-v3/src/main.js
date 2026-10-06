import './style.css'
import {configured,supabase} from './lib/supabase.js'
import {ensureProfile,signOut,touchPresence} from './services/auth.js'
import {authScreen} from './features/auth.js'
import {renderFeed} from './features/feed.js'
import {renderProfile} from './features/profile.js'
import {renderMessages} from './features/messages.js'
import {notifications,markNotifications,unreadNotifications,people,posts} from './services/data.js'
import {avatar,esc,icon,ago,toast,applyTheme,currentTheme} from './lib/ui.js'

const app=document.querySelector('#app');let user=null,profile=null
if(!configured){app.innerHTML=`<main class="auth-screen"><section class="auth-card"><div class="auth-brand"><span class="brand-mark">Т</span><div><strong>ТВЕРЬ</strong><span>Social</span></div></div><h1>Почти готово</h1><p>Добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в окружение Vercel.</p></section></main>`;throw new Error('Supabase env missing')}

const route=()=>{const h=location.hash.replace('#','');if(h.startsWith('profile/'))return['profile',h.split('/')[1]];if(h.startsWith('search/'))return['search',decodeURIComponent(h.slice(7))];return[h||'feed',null]}

async function boot(){const s=(await supabase.auth.getSession()).data.session;if(!s){authScreen({onSuccess:()=>boot()});return}user=s.user;profile=await ensureProfile(user);touchPresence(user.id);await renderShell();await navigate(route()[0],route()[1])}

function navButton(id,label,ic){return `<button class="nav-link" data-go="${id}" data-nav-id="${id}"><span class="nav-icon">${icon(ic)}</span><b>${label}</b><i class="nav-badge" data-badge="${id}"></i></button>`}

async function renderShell(){
 applyTheme(currentTheme())
 app.innerHTML=`<div class="app-shell"><header class="topbar-v2"><button class="brand-v2" data-go="feed"><span class="brand-mark">Т</span><span class="brand-word"><strong>ТВЕРЬ</strong><em>Social</em></span></button><div class="global-search-v2"><span>${icon('search')}</span><input id="search" placeholder="Поиск людей и публикаций" autocomplete="off"><kbd>⌘ K</kbd><div id="search-pop"></div></div><div class="top-actions-v2"><button class="icon-btn" id="theme-toggle" aria-label="Тема">${icon(currentTheme()==='dark'?'sun':'moon')}</button><button class="icon-btn notif-btn" data-go="notifications" aria-label="Уведомления">${icon('bell')}<i id="notif-dot"></i></button><button class="top-avatar" data-go="profile">${avatar(profile,'sm')}</button><button class="icon-btn mobile-menu" id="logout" aria-label="Выйти">${icon('dots')}</button></div></header>
 <div class="shell-body"><aside class="sidebar-v2"><div class="sidebar-inner"><div class="sidebar-nav">${navButton('feed','Главная','home')}${navButton('search','Поиск','search')}${navButton('messages','Сообщения','chat')}${navButton('notifications','Уведомления','bell')}${navButton('bookmarks','Сохранённое','bookmark')}</div><button class="create-sidebar" id="sidebar-create"><span>${icon('plus')}</span><b>Создать</b><small>N</small></button><div class="sidebar-bottom"><button class="profile-mini" data-go="profile">${avatar(profile,'sm')}<span><b>${esc(profile.full_name||profile.username)}</b><small>@${esc(profile.username)}</small></span>${icon('dots')}</button><button class="theme-row" id="theme-row">${icon(currentTheme()==='dark'?'sun':'moon')}<span>${currentTheme()==='dark'?'Светлая тема':'Тёмная тема'}</span></button><button class="logout-row" id="logout2">Выйти из аккаунта</button></div></div></aside><main id="main" class="main-v2"></main></div><nav class="mobile-nav-v2">${navButton('feed','','home')}${navButton('search','','search')}<button class="mobile-create" id="mobile-create">${icon('plus')}</button>${navButton('notifications','','bell')}${navButton('profile','','user')}</nav></div>`
 document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>{const v=x.dataset.go;location.hash=v==='profile'?`profile/${user.id}`:v;navigate(v,v==='profile'?user.id:null)})
 document.querySelector('#sidebar-create').onclick=()=>openQuickComposer()
 document.querySelector('#mobile-create').onclick=()=>openQuickComposer()
 document.querySelector('#logout2').onclick=doLogout
 document.querySelector('#logout').onclick=()=>toast('Открой профиль для выхода из аккаунта')
 document.querySelector('#theme-toggle').onclick=toggleTheme
 document.querySelector('#theme-row').onclick=toggleTheme
 const input=document.querySelector('#search');let timer;input.onfocus=()=>{if(input.value.trim())searchPop(input.value.trim())};input.oninput=()=>{clearTimeout(timer);const q=input.value.trim();timer=setTimeout(()=>searchPop(q),220)};input.onkeydown=e=>{if(e.key==='Enter'&&input.value.trim()){location.hash=`search/${encodeURIComponent(input.value.trim())}`;navigate('search',input.value.trim());input.blur()};if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus()}}
 await updateNotifBadge()
}
function toggleTheme(){const next=currentTheme()==='dark'?'light':'dark';applyTheme(next);renderShell().then(()=>navigate(...route()))}
async function updateNotifBadge(){const n=await unreadNotifications(user.id);const dot=document.querySelector('#notif-dot');if(dot)dot.classList.toggle('show',n>0);document.querySelectorAll('[data-badge="notifications"]').forEach(x=>{x.textContent=n>9?'9+':n||'';x.classList.toggle('show',n>0)})}
async function doLogout(){await signOut();user=null;profile=null;location.hash='';authScreen({onSuccess:boot})}

async function navigate(view,param){const main=document.querySelector('#main');if(!main)return;if(view==='feed')return renderFeed({app:main,user,profile,navigate:routeNav});if(view==='profile')return renderProfile({app:main,user,id:param||user.id,navigate:routeNav});if(view==='messages')return renderMessages({app:main,user});if(view==='notifications')return renderNotifications();if(view==='search')return renderSearch(param||'');if(view==='bookmarks')return renderBookmarks()}
const routeNav=v=>{location.hash=v==='profile'?`profile/${user.id}`:v;navigate(v,v==='profile'?user.id:null)}

async function renderNotifications(){
 const main=document.querySelector('#main');main.innerHTML=`<div class="page-head"><div><span class="eyebrow">ЦЕНТР АКТИВНОСТИ</span><h1>Уведомления</h1><p>Всё, что произошло с твоим профилем.</p></div><button class="btn secondary" id="read-all">${icon('check')} Отметить всё</button></div><div class="notification-list-v2"><div class="skeleton-stack" id="notification-skeleton"><div class="skeleton notification-skel"></div><div class="skeleton notification-skel"></div></div></div>`
 try{const list=await notifications(user.id);document.querySelector('.notification-list-v2').innerHTML=list.length?list.map(n=>{const a=n.profiles;let text=n.type==='like'?'понравилась твоя публикация':n.type==='comment'?'прокомментировал(а) твою публикацию':'подписался(ась) на тебя';return `<button class="notification-v2 ${n.read_at?'':'unread'}">${avatar(a,'md')}<span><b>${esc(a?.full_name||a?.username||'Пользователь')}</b> ${text}<small>${ago(n.created_at)}</small></span><i class="notif-type ${n.type}">${icon(n.type==='like'?'heart':n.type==='comment'?'chat':'user',n.type==='like')}</i></button>`}).join(''):`<div class="empty-state"><div class="empty-icon">${icon('bell')}</div><h2>Здесь пока тихо</h2><p>Новые лайки, комментарии и подписки появятся здесь.</p></div>`;document.querySelector('#read-all').onclick=async()=>{await markNotifications(user.id);toast('Всё прочитано','success');await renderNotifications();await updateNotifBadge()};await markNotifications(user.id);await updateNotifBadge()}catch(e){document.querySelector('.notification-list-v2').innerHTML=`<div class="empty-state"><p>${esc(e.message)}</p></div>`}
}

async function renderSearch(q){
 const main=document.querySelector('#main');main.innerHTML=`<div class="page-head"><div><span class="eyebrow">ПОИСК</span><h1>${q?`Результаты для «${esc(q)}»`:'Найди людей'}</h1><p>Ищи по имени, username или тексту публикации.</p></div></div><div class="search-tabs"><button class="active">Люди</button><button>Публикации</button></div><div id="search-results" class="search-results"><div class="skeleton-stack"><div class="skeleton search-skel"></div><div class="skeleton search-skel"></div></div></div>`
 try{const [ps,feed]=await Promise.all([people(q),posts({search:q,limit:10})]);const box=document.querySelector('#search-results');box.innerHTML=`<div class="search-section"><div class="section-title"><span>Люди</span><small>${ps.length}</small></div>${ps.length?ps.map(p=>`<button class="person-result-v2" data-person="${p.id}">${avatar(p,'md')}<span><b>${esc(p.full_name||p.username)}</b><small>@${esc(p.username||'user')} · ${esc(p.city||'Тверь')}</small></span>${icon('arrow')}</button>`).join(''):`<div class="search-empty-v2">Людей по этому запросу не нашли.</div>`}</div><div class="search-section"><div class="section-title"><span>Публикации</span><small>${feed.length}</small></div>${feed.length?feed.map(p=>`<button class="search-post-result" data-post-result="${p.id}">${avatar(p.profiles,'xs')}<span><b>${esc(p.profiles?.full_name||p.profiles?.username)}</b><small>${esc((p.content||'Без текста').slice(0,120))}</small></span>${icon('arrow')}</button>`).join(''):`<div class="search-empty-v2">Публикаций по этому запросу не нашли.</div>`}</div>`;box.querySelectorAll('[data-person]').forEach(x=>x.onclick=()=>{location.hash=`profile/${x.dataset.person}`;navigate('profile',x.dataset.person)});box.querySelectorAll('[data-post-result]').forEach(x=>{x.onclick=()=>{location.hash='feed';navigate('feed')}})}catch(e){document.querySelector('#search-results').innerHTML=`<div class="empty-state"><p>${esc(e.message)}</p></div>`}
}

async function renderBookmarks(){
 const main=document.querySelector('#main');main.innerHTML=`<div class="page-head"><div><span class="eyebrow">ЛИЧНАЯ КОЛЛЕКЦИЯ</span><h1>Сохранённое</h1><p>Публикации, которые ты решил оставить себе.</p></div></div><div id="bookmark-content">${'<div class="skeleton-stack"><div class="skeleton bookmark-skel"></div><div class="skeleton bookmark-skel"></div></div>'}</div>`
 const b=await supabase.from('bookmarks').select('post_id,created_at').eq('user_id',user.id).order('created_at',{ascending:false});const ids=(b.data||[]).map(x=>x.post_id);const all=[];for(const id of ids.slice(0,30)){const p=await posts({search:'',limit:50});const found=p.find(x=>x.id===id);if(found)all.push(found)}
 document.querySelector('#bookmark-content').innerHTML=all.length?`<div class="bookmark-grid">${all.map(p=>`<article class="saved-card">${p.media_urls?.[0]?`<img src="${esc(p.media_urls[0])}" alt="" loading="lazy">`:''}<div class="saved-copy">${avatar(p.profiles,'xs')}<div><b>${esc(p.profiles?.full_name||p.profiles?.username)}</b><small>${ago(p.created_at)}</small></div></div><p>${esc(p.content||'Сохранённая публикация')}</p></article>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">${icon('bookmark')}</div><h2>Пока пусто</h2><p>Нажми закладку под публикацией, чтобы сохранить её сюда.</p><button class="btn primary" data-go="feed">Открыть ленту ${icon('arrow')}</button></div>`
}

async function searchPop(q){const pop=document.querySelector('#search-pop');if(!q){pop.innerHTML='';pop.classList.remove('show');return}try{const ps=await people(q);pop.innerHTML=ps.slice(0,6).map(p=>`<button data-person="${p.id}">${avatar(p,'xs')}<span><b>${esc(p.full_name||p.username)}</b><small>@${esc(p.username)}</small></span>${icon('arrow')}</button>`).join('')||`<div class="search-pop-empty">Ничего не нашли</div>`;pop.classList.add('show');pop.querySelectorAll('[data-person]').forEach(x=>x.onclick=()=>{location.hash=`profile/${x.dataset.person}`;navigate('profile',x.dataset.person);pop.classList.remove('show')})}catch{}}

async function openQuickComposer(){
 const feed=await import('./features/feed.js');
 const fake={};
 // Reuse the feed composer without duplicating its implementation.
 location.hash='feed';await navigate('feed');document.querySelector('#new-post')?.click()
}

supabase.auth.onAuthStateChange((_e,s)=>{if(s?.user&&!user)boot();if(!s?.user&&user){user=null;profile=null;authScreen({onSuccess:boot})}})
window.addEventListener('hashchange',()=>{const [v,p]=route();if(user)navigate(v,p)})
window.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#search')?.focus()}if(e.key==='Escape')document.querySelector('.modal-backdrop')?.remove()})
boot()
