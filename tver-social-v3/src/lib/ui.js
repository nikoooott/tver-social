export const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))

export const initials=(name='Т')=>name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'Т'

const avatarPalette=['violet','blue','cyan','green','orange','rose','indigo','teal']
export function avatarColor(value='Т'){
  let n=0; for(const ch of String(value)) n=(n*31+ch.charCodeAt(0))>>>0
  return avatarPalette[n%avatarPalette.length]
}
export const avatar=(p,cls='')=>{
  const name=p?.full_name||p?.username||'Пользователь'
  return p?.avatar_url
    ? `<img class="avatar ${cls}" src="${esc(p.avatar_url)}" alt="${esc(name)}" loading="lazy">`
    : `<span class="avatar avatar-${avatarColor(name)} ${cls}" aria-label="${esc(name)}">${esc(initials(name))}</span>`
}

export const ago=d=>{
  const diff=Math.max(0,Date.now()-new Date(d).getTime()),m=Math.floor(diff/60000)
  if(m<1)return'сейчас'; if(m<60)return`${m} мин`; const h=Math.floor(m/60)
  if(h<24)return`${h} ч`; const days=Math.floor(h/24)
  if(days<7)return`${days} д`; return new Date(d).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})
}

const svg=(body,view='24')=>`<svg viewBox="0 0 ${view} ${view}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
export const icon=(name,filled=false)=>{
  const p={
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    chat:'<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9.7 9.7 0 0 1-4-.8L4 20l1.4-3.4A7.1 7.1 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z"/>',
    bookmark:'<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3Z"/>',
    heart:'<path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    share:'<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="m16 6-4-4-4 4M12 2v13"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    settings:'<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"/><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H4a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9V2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/>',
    spark:'<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z"/>',
    dots:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    back:'<path d="m15 18-6-6 6-6"/>',
    link:'<path d="M10 13.5a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 10.5a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 19.5l1.1-1.1"/>'
  }[name]||''
  if(filled&&name==='heart') return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"/></svg>`
  return svg(p)
}

export function toast(message,type='info'){let host=document.querySelector('#toast-host');if(!host){host=document.createElement('div');host.id='toast-host';document.body.append(host)}const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=`<span class="toast-icon">${icon(type==='error'?'close':type==='success'?'check':'spark')}</span><span>${esc(message)}</span>`;host.append(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),220)},2800)}

export function modal(html,{sheet=false,onClose}={}){const wrap=document.createElement('div');wrap.className=`modal-backdrop ${sheet?'sheet-backdrop':''}`;wrap.innerHTML=`<section class="modal ${sheet?'sheet-modal':''}" role="dialog" aria-modal="true">${html}</section>`;document.body.append(wrap);const close=()=>{wrap.classList.add('closing');setTimeout(()=>wrap.remove(),160);onClose?.()};wrap.addEventListener('click',e=>{if(e.target===wrap)close()});wrap.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',close));return{wrap,close}}

export const setBusy=(el,busy,label='')=>{if(!el)return;el.disabled=busy;if(busy){el.dataset.old=el.innerHTML;el.innerHTML=`<span class="spinner"></span>${label}`}else el.innerHTML=el.dataset.old||label}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms))

export function applyTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem('tver-theme',theme)}
export function currentTheme(){return localStorage.getItem('tver-theme')||'light'}
