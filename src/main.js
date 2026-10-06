import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

const demoPosts = [
  {id:'d1', author:'Алина Морозова', handle:'alina.tver', avatar:'https://i.pravatar.cc/120?img=47', image:'https://images.unsplash.com/photo-1548777123-e216912df7d8?auto=format&fit=crop&w=1200&q=85', text:'Вечерняя Тверь всегда какая-то особенная ❤️', likes:248, comments:18, time:'24 мин'},
  {id:'d2', author:'Макс Тверской', handle:'maks.tver', avatar:'https://i.pravatar.cc/120?img=12', image:'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85', text:'Кто сегодня гуляет по центру?', likes:173, comments:9, time:'1 ч'},
  {id:'d3', author:'Кристина', handle:'kris.tver', avatar:'https://i.pravatar.cc/120?img=32', image:'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=1200&q=85', text:'Тверь, которую я люблю.', likes:91, comments:6, time:'3 ч'}
]

const app = document.querySelector('#app')
let posts = [...demoPosts]
let currentUser = null
let liked = new Set()

function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function initials(n='Т') { return esc(n.trim().slice(0,1).toUpperCase()) }
function avatar(url,name){return url ? `<img class="avatar" src="${esc(url)}" alt="">` : `<div class="avatar fallback">${initials(name)}</div>`}

function shell(){
 app.innerHTML = `
 <header class="topbar">
   <div class="topinner">
     <button class="brand" id="homeBtn"><span>Т</span><b>Тверь</b><em>social</em></button>
     <div class="search"><span>⌕</span><input id="search" placeholder="Поиск людей и публикаций"></div>
     <nav><button class="navbtn active" id="feedBtn">Главная</button><button class="navbtn" id="peopleBtn">Люди</button><button class="profileBtn" id="authBtn">${currentUser ? avatar(currentUser.user_metadata?.avatar_url,currentUser.user_metadata?.name||currentUser.email) : 'Войти'}</button></nav>
   </div>
 </header>
 <main class="page">
   <section class="hero">
     <div><div class="eyebrow">СВОЯ СЕТЬ ГОРОДА</div><h1>Тверь <span>в одном месте.</span></h1><p>Фотографии, люди, места и разговоры жителей Твери.</p></div>
     <button class="primary" id="createBtn">＋ Опубликовать</button>
   </section>
   <div class="chips"><button class="chip active">Для вас</button><button class="chip">Тверь</button><button class="chip">Популярное</button><button class="chip">Рядом</button></div>
   <div class="layout"><section><div id="feed"></div></section><aside id="aside"></aside></div>
 </main>
 <div id="modal"></div><div id="toast"></div>`
 document.querySelector('#homeBtn').onclick=()=>renderFeed()
 document.querySelector('#feedBtn').onclick=()=>renderFeed()
 document.querySelector('#peopleBtn').onclick=()=>renderPeople()
 document.querySelector('#authBtn').onclick=()=>currentUser?renderProfile():openAuth()
 document.querySelector('#createBtn').onclick=()=>currentUser?openComposer():openAuth()
 document.querySelector('#search').oninput=e=>filterFeed(e.target.value)
 renderFeed()
}

function renderFeed(){
 const feed=document.querySelector('#feed')
 feed.innerHTML=`<div class="sectionhead"><div><h2>Лента Твери</h2><p>Последнее от людей города</p></div><span class="live">● LIVE</span></div>` + posts.map(postCard).join('')
 document.querySelector('#aside').innerHTML=`
 <div class="sidecard dark"><div class="mini-eyebrow">ТВЕРЬ</div><h3>Городская лента</h3><p>Здесь люди из Твери делятся тем, что видят, любят и обсуждают каждый день.</p><div class="stats"><div><b>12.8K</b><span>участников</span></div><div><b>3.4K</b><span>постов</span></div></div></div>
 <div class="sidecard"><h3>🔥 Сейчас обсуждают</h3>${['#Тверь','#ИщуТверь','#ВТвериЛюбят','#ТверскаяОбласть'].map((x,i)=>`<div class="trend"><b>${x}</b><span>${2481-i*421} публикаций</span></div>`).join('')}</div>
 <div class="sidecard"><h3>👥 Люди Твери</h3>${['Алина','Макс','Кристина'].map((x,i)=>`<div class="person"><img src="https://i.pravatar.cc/80?img=${47-i*12}"><div><b>${x}</b><span>@${x.toLowerCase()}_tver</span></div><button class="follow" onclick="toast('Скоро: подписки')">+</button></div>`).join('')}</div>`
}

function postCard(p){
 const isDemo=p.id.startsWith('d')
 return `<article class="post" data-search="${esc((p.author+' '+p.text+' '+p.handle).toLowerCase())}">
   <div class="posthead">${avatar(p.avatar,p.author)}<div class="who"><b>${esc(p.author)}</b><span>@${esc(p.handle||'tver')} · ${esc(p.time||'только что')}</span></div><button class="dots">•••</button></div>
   <img class="postimg" src="${esc(p.image)}" alt="Фото из Твери" loading="lazy">
   <div class="postbody">
    <div class="actions"><button class="act ${liked.has(p.id)?'liked':''}" onclick="toggleLike('${p.id}',this)">♥</button><button class="act" onclick="openComments('${p.id}')">◯</button><button class="act" onclick="sharePost('${p.id}')">↗</button><button class="act save">⌑</button></div>
    <div class="likecount"><b>${p.likes + (liked.has(p.id)?1:0)}</b> отметок «Нравится»</div>
    <div class="caption"><b>${esc(p.author)}</b> ${esc(p.text)}</div>
    <button class="comments" onclick="openComments('${p.id}')">Посмотреть все ${p.comments} комментариев</button>
   </div>
 </article>`
}

function filterFeed(q){document.querySelectorAll('.post').forEach(x=>x.style.display=!q||x.dataset.search.includes(q.toLowerCase())?'':'none')}

async function toggleLike(id,btn){
 if(!liked.has(id)){liked.add(id);btn.classList.add('liked')}else{liked.delete(id);btn.classList.remove('liked')}
 const p=posts.find(x=>x.id===id); if(p){p.likes += liked.has(id)?1:-1; btn.closest('.post').querySelector('.likecount b').textContent=p.likes}
 if(supabase && currentUser && !id.startsWith('d')){
   await supabase.from('likes').upsert({post_id:id,user_id:currentUser.id})
 }
}

function openComments(id){
 const p=posts.find(x=>x.id===id); if(!p)return
 showModal(`<div class="modalhead"><div><h2>Комментарии</h2><p>${esc(p.comments)} комментариев</p></div><button class="close" onclick="closeModal()">×</button></div><div class="commentslist"><div class="comment"><b>Мария</b><span>Очень красиво! ❤️</span></div><div class="comment"><b>Даня</b><span>Тоже сегодня был в центре</span></div></div>${currentUser?`<div class="commentform"><input id="commentInput" placeholder="Написать комментарий..."><button class="primary" onclick="addComment('${id}')">Отправить</button></div>`:'<p class="muted">Войдите, чтобы комментировать.</p>'}`)
}
function addComment(id){const v=document.querySelector('#commentInput')?.value.trim();if(!v)return;toast('Комментарий добавлен');closeModal()}

function sharePost(){navigator.share?.({title:'Тверь Social',text:'Смотри публикацию из Твери'})?.catch(()=>{});toast('Ссылка на публикацию готова')}
function toast(t){const e=document.querySelector('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function showModal(html){document.querySelector('#modal').innerHTML=`<div class="overlay"><div class="modalbox">${html}</div></div>`}
function closeModal(){document.querySelector('#modal').innerHTML=''}

function openAuth(){
 showModal(`<div class="modalhead"><div><div class="mini-eyebrow">ТВЕРЬ SOCIAL</div><h2>Войти в Тверь</h2><p>Создай профиль и общайся с городом.</p></div><button class="close" onclick="closeModal()">×</button></div>
 <div class="auth-tabs"><button class="selected" id="loginTab">Вход</button><button id="regTab">Регистрация</button></div>
 <form id="authForm"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" placeholder="Пароль" required minlength="6"><input id="name" class="hidden" placeholder="Имя в Тверь Social"><button class="primary wide">Продолжить</button></form>
 <p class="muted center" id="authMsg"></p>`)
 let mode='login'
 document.querySelector('#loginTab').onclick=()=>{mode='login';document.querySelector('#name').classList.add('hidden');document.querySelector('#loginTab').classList.add('selected');document.querySelector('#regTab').classList.remove('selected')}
 document.querySelector('#regTab').onclick=()=>{mode='reg';document.querySelector('#name').classList.remove('hidden');document.querySelector('#regTab').classList.add('selected');document.querySelector('#loginTab').classList.remove('selected')}
 document.querySelector('#authForm').onsubmit=async e=>{
  e.preventDefault(); if(!supabase){document.querySelector('#authMsg').textContent='Сначала подключи Supabase в Vercel.';return}
  const email=emailEl().value,password=document.querySelector('#password').value,name=document.querySelector('#name').value.trim()
  let r=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{data:{name}}})
  if(r.error){document.querySelector('#authMsg').textContent=r.error.message;return}
  if(mode==='reg' && !r.data.session){document.querySelector('#authMsg').textContent='Проверь почту для подтверждения аккаунта.'}
  else{currentUser=r.data.user;closeModal();shell()}
 }
 function emailEl(){return document.querySelector('#email')}
}

function openComposer(){
 showModal(`<div class="modalhead"><div><div class="mini-eyebrow">НОВАЯ ПУБЛИКАЦИЯ</div><h2>Что нового в Твери?</h2></div><button class="close" onclick="closeModal()">×</button></div>
 <form id="postForm"><input id="postText" placeholder="Напиши что-нибудь..." maxlength="500"><input id="postImage" type="url" placeholder="Ссылка на фото (JPG/PNG)"><button class="primary wide">Опубликовать</button><p class="muted">Для настоящей загрузки файлов подключим Supabase Storage.</p></form>`)
 document.querySelector('#postForm').onsubmit=async e=>{
  e.preventDefault();const text=document.querySelector('#postText').value.trim(),image=document.querySelector('#postImage').value.trim();if(!text||!image)return
  if(supabase&&currentUser){const {data,error}=await supabase.from('posts').insert({user_id:currentUser.id,content:text,image_url:image}).select('*,profiles(*)').single();if(!error&&data){posts.unshift({id:data.id,author:data.profiles?.name||currentUser.user_metadata?.name||'Пользователь',handle:data.profiles?.username||'tver',avatar:data.profiles?.avatar_url,image:data.image_url,text:data.content,likes:0,comments:0,time:'только что'});closeModal();renderFeed();toast('Публикация опубликована');return}}
  posts.unshift({id:'local'+Date.now(),author:currentUser?.user_metadata?.name||'Нико',handle:'tver_user',avatar:currentUser?.user_metadata?.avatar_url,image,text,likes:0,comments:0,time:'только что'});closeModal();renderFeed();toast('Публикация добавлена')
 }
}

function renderPeople(){
 document.querySelector('#feed').innerHTML=`<div class="sectionhead"><div><h2>Люди Твери</h2><p>Знакомься, подписывайся, общайся</p></div></div><div class="peoplegrid">${['Алина Морозова','Макс Тверской','Кристина','Даня','Саша','Мария'].map((n,i)=>`<div class="personcard"><img src="https://i.pravatar.cc/160?img=${12+i*7}"><h3>${n}</h3><p>@${n.split(' ')[0].toLowerCase()}_tver</p><button class="follow big" onclick="toast('Подписка оформлена')">Подписаться</button></div>`).join('')}</div>`
 document.querySelector('#aside').innerHTML=`<div class="sidecard dark"><h3>💬 Общайся</h3><p>В будущем здесь появятся личные сообщения, городские чаты и группы по интересам.</p></div>`
}
function renderProfile(){renderPeople();toast('Профиль пользователя')}
supabase?.auth.getSession().then(({data})=>{currentUser=data.session?.user||null;shell()})
if(!supabase)shell()
window.openAuth=openAuth;window.openComposer=openComposer;window.closeModal=closeModal;window.toggleLike=toggleLike;window.openComments=openComments;window.addComment=addComment;window.sharePost=sharePost;window.toast=toast
