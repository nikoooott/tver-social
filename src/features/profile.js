import {profile,posts,following,follow,counts,updateProfile,uploadImages,startConversation} from '../services/data.js'
import {avatar,esc,ago,icon,modal,setBusy,toast} from '../lib/ui.js'

export async function renderProfile({app,user,id,navigate}){
  app.innerHTML=`<div class="profile-skeleton"><div class="skeleton skeleton-hero"></div><div class="skeleton skeleton-lines"></div></div>`
  try{
    const p=await profile(id||user.id),[list,stats,isFollowing]=await Promise.all([posts({userId:p.id,viewerId:user.id}),counts(p.id),p.id===user.id?false:following(p.id,user.id)])
    const isOwn=p.id===user.id
    const media=list.filter(x=>(x.media_urls?.length||x.image_url))
    const totalViews=list.reduce((sum,x)=>sum+(x.view_count||0),0)
    app.innerHTML=`<div class="profile-page">
      <section class="profile-hero profile-hero-v3">
        <div class="profile-banner"><div class="banner-grid"></div><div class="banner-glow"></div><div class="profile-banner-actions">${isOwn?`<button class="ghost-btn" id="edit">${icon('settings')} Настроить профиль</button>`:''}</div></div>
        <div class="profile-main">
          <div class="profile-avatar-wrap">${avatar(p,'xxl')}<span class="online-ring ${isOnline(p)?'show':''}"></span></div>
          <div class="profile-identity"><div class="profile-name-row"><div><h1>${esc(p.full_name||'Пользователь')}</h1><div class="handle">@${esc(p.username||'user')}</div></div><div class="profile-actions">${isOwn?`<button class="btn secondary" id="edit-mobile">${icon('settings')} Редактировать</button>`:`<button class="btn ${isFollowing?'secondary':'primary'} follow-btn" id="follow" data-followed="${isFollowing}">${isFollowing?icon('check'):icon('plus')} <span>${isFollowing?'Вы подписаны':'Подписаться'}</span></button><button class="icon-btn large" id="message" aria-label="Написать">${icon('chat')}</button>`}</div></div>
            <p class="profile-bio">${esc(p.bio||'Расскажи о себе — это место для твоей истории.')}</p>
            <div class="profile-meta">${p.city?`<span>${icon('home')} ${esc(p.city)}</span>`:''}<span>${icon('spark')} В ТВЕРЬ Social с ${new Date(p.created_at||Date.now()).toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</span></div>
            <div class="profile-stats-v3"><button><b>${stats.posts}</b><span>публикаций</span></button><button><b id="followers-count">${stats.followers}</b><span>подписчиков</span></button><button><b>${stats.following}</b><span>подписок</span></button><button><b>${totalViews}</b><span>просмотров</span></button></div>
          </div>
        </div>
      </section>
      <nav class="profile-tabs profile-tabs-v3"><button class="active" data-tab="posts">Публикации <span>${stats.posts}</span></button><button data-tab="media">Медиа <span>${media.length}</span></button><button data-tab="about">О себе</button></nav>
      <section id="profile-content">${renderPostCards(list)}</section>
    </div>`
    const switchTab=(tab)=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));document.querySelector('#profile-content').innerHTML=tab==='media'?renderMedia(media):tab==='about'?renderAbout(p):renderPostCards(list);bindProfileMedia()}
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab))
    document.querySelector('#edit')?.addEventListener('click',()=>openEdit(p,user,()=>renderProfile({app,user,id:p.id,navigate})))
    document.querySelector('#edit-mobile')?.addEventListener('click',()=>openEdit(p,user,()=>renderProfile({app,user,id:p.id,navigate})))
    document.querySelector('#follow')?.addEventListener('click',async e=>{
      const b=e.currentTarget,old=b.dataset.followed==='true';b.disabled=true;b.classList.add('pending')
      try{await follow(p.id,user.id,old);b.dataset.followed=String(!old);b.classList.toggle('secondary',!old);b.classList.toggle('primary',old);b.innerHTML=`${icon(!old?'check':'plus')} <span>${!old?'Вы подписаны':'Подписаться'}</span>`;const n=document.querySelector('#followers-count');if(n)n.textContent=Number(n.textContent)+(old?-1:1);toast(old?'Подписка отменена':'Вы подписались','success')}catch(err){toast(err.message||'Не удалось изменить подписку','error')}finally{b.disabled=false;b.classList.remove('pending')}})
    document.querySelector('#message')?.addEventListener('click',async()=>{try{await startConversation(user.id,p.id);location.hash='messages';navigate('messages')}catch(e){toast(e.message||'Не удалось открыть диалог','error')}})
    bindProfileMedia()
  }catch(e){app.innerHTML=`<div class="empty-state"><div class="empty-icon">${icon('user')}</div><h2>Профиль не загрузился</h2><p>${esc(e.message)}</p></div>`}
}

function bindProfileMedia(){document.querySelectorAll('[data-profile-image]').forEach(b=>b.onclick=()=>{const m=modal(`<button class="viewer-close" data-close>${icon('close')}</button><img class="viewer-img" src="${esc(b.dataset.profileImage)}" alt="">`);m.wrap.classList.add('viewer-wrap')})}
function isOnline(p){return p.last_seen&&Date.now()-new Date(p.last_seen).getTime()<5*60*1000}
function renderPostCards(list){
 if(!list.length)return`<div class="empty-state profile-empty"><div class="empty-icon">${icon('spark')}</div><h2>Публикаций пока нет</h2><p>Когда пользователь что-нибудь опубликует, это появится здесь.</p></div>`
 return `<div class="profile-feed-list">${list.map(p=>{const imgs=p.media_urls?.length?p.media_urls:(p.image_url?[p.image_url]:[]);return `<article class="profile-post-card"><header>${avatar(p.profiles||{},'sm')}<div><b>${esc(p.profiles?.full_name||'Публикация')}</b><small>${ago(p.created_at)}</small></div><span class="profile-post-view">${icon('eye')} ${p.view_count||0}</span></header>${p.content?`<p>${esc(p.content).replaceAll('\n','<br>')}</p>`:''}${imgs.length?`<button class="profile-post-image" data-profile-image="${esc(imgs[0])}"><img src="${esc(imgs[0])}" alt="" loading="lazy">${imgs.length>1?`<span>+${imgs.length-1}</span>`:''}</button>`:''}<footer><span>${icon('heart')} ${p.like_count||0}</span><span>${icon('chat')} ${p.comment_count||0}</span><span>${icon('eye')} ${p.view_count||0}</span></footer></article>`}).join('')}</div>`
}
function renderMedia(list){if(!list.length)return`<div class="empty-state profile-empty"><div class="empty-icon">${icon('image')}</div><h2>Медиа пока нет</h2><p>Фотографии публикаций появятся здесь.</p></div>`;return `<div class="profile-media-grid">${list.flatMap(p=>(p.media_urls?.length?p.media_urls:(p.image_url?[p.image_url]:[])).map(src=>`<button class="profile-media-tile" data-profile-image="${esc(src)}"><img src="${esc(src)}" loading="lazy" alt=""><span>${icon('eye')} ${p.view_count||0}</span></button>`)).join('')}</div>`}
function renderAbout(p){return`<div class="about-card about-card-v3"><div class="about-intro"><div>${avatar(p,'lg')}</div><div><h2>${esc(p.full_name||'Пользователь')}</h2><p>@${esc(p.username||'user')}</p></div></div><div class="about-grid"><div class="about-row"><span>Город</span><b>${esc(p.city||'Тверь')}</b></div><div class="about-row"><span>Имя</span><b>${esc(p.full_name||'—')}</b></div><div class="about-row"><span>Username</span><b>@${esc(p.username||'—')}</b></div><div class="about-row"><span>О себе</span><b>${esc(p.bio||'—')}</b></div></div></div>`}

function openEdit(p,user,onDone){
 const m=modal(`<header class="modal-head"><div><span class="eyebrow">ПРОФИЛЬ</span><h2>Настроить профиль</h2></div><button class="icon-btn" data-close>${icon('close')}</button></header><form id="profile-form" class="form premium-form"><div class="edit-avatar">${avatar(p,'xl')}<label class="avatar-edit">${icon('image')} Фото<input name="avatar" type="file" accept="image/*" hidden></label></div><label>Имя<input name="name" value="${esc(p.full_name||'')}" maxlength="60" required></label><label>Username<div class="field-shell"><span class="at">@</span><input name="username" value="${esc(p.username||'')}" minlength="4" maxlength="20" required></div><small class="field-hint">Username уникален и используется для поиска.</small></label><label>Город<input name="city" value="${esc(p.city||'Тверь')}" maxlength="50"></label><label>О себе<textarea name="bio" maxlength="300" rows="4" placeholder="Расскажи о себе…">${esc(p.bio||'')}</textarea></label><button class="btn primary btn-wide">Сохранить изменения ${icon('check')}</button></form>`)
 const form=m.wrap.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const b=e.submitter,fd=new FormData(form);setBusy(b,true,'');try{const clean=fd.get('username').trim().toLowerCase();const {usernameAvailable}=await import('../services/auth.js');const check=await usernameAvailable(clean,user.id);if(!check.ok)throw Error(check.reason);let avatar_url=p.avatar_url;const f=fd.get('avatar');if(f?.size)avatar_url=(await uploadImages(user.id,[f]))[0];await updateProfile(user.id,{full_name:fd.get('name').trim(),username:clean,city:fd.get('city').trim(),bio:fd.get('bio').trim(),avatar_url});toast('Профиль обновлён','success');m.close();onDone()}catch(err){toast(err.message||'Не удалось сохранить','error')}finally{setBusy(b,false)}}
}
