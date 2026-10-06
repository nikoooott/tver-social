import {signIn,signUp,usernameAvailable} from '../services/auth.js'
import {esc,setBusy,icon,avatar} from '../lib/ui.js'

export function authScreen({onSuccess}){
  const app=document.querySelector('#app');let mode='login';
  const draw=()=>{
    const reg=mode==='register'
    app.innerHTML=`<main class="auth-screen"><div class="auth-orbit orbit-a"></div><div class="auth-orbit orbit-b"></div><section class="auth-card">
      <div class="auth-brand"><span class="brand-mark">Т</span><div><strong>ТВЕРЬ</strong><span>Social</span></div></div>
      <div class="auth-copy"><span class="eyebrow">${reg?'НОВЫЙ ПРОФИЛЬ':'СНОВА В ГОРОДЕ'}</span><h1>${reg?'Твой город. Твои люди.':'С возвращением.'}</h1><p>${reg?'Создай профиль за минуту и присоединяйся к разговорам Твери.':'Продолжи общение, публикации и сообщения.'}</p></div>
      ${reg?`<div class="onboarding-dots"><i class="active"></i><i></i><i></i></div>`:''}
      <form id="auth-form" class="auth-form">
        ${reg?`<div class="field"><label>Имя</label><div class="field-shell"><input name="full_name" maxlength="60" required placeholder="Нико" autocomplete="name"><span class="field-check"></span></div></div>
        <div class="field"><label>Username</label><div class="field-shell"><span class="at">@</span><input id="username" name="username" minlength="4" maxlength="20" required placeholder="niko" autocomplete="username"><span id="username-state" class="username-state"></span></div><small class="field-hint">Уникальный адрес профиля. Только латиница, цифры и _</small></div>
        <div class="auth-row"><div class="field"><label>Возраст</label><div class="field-shell"><input name="age" type="number" min="13" max="120" required placeholder="18"></div></div><div class="field"><label>Город</label><div class="field-shell"><input name="city" value="Тверь" maxlength="50" placeholder="Тверь"></div></div></div>`:''}
        <div class="field"><label>Email</label><div class="field-shell"><input name="email" type="email" required placeholder="you@example.com" autocomplete="email"></div></div>
        <div class="field"><label>Пароль</label><div class="field-shell"><input name="password" type="password" minlength="6" required placeholder="Минимум 6 символов" autocomplete="new-password"><button type="button" class="password-toggle" id="password-toggle">${icon('user')}</button></div></div>
        <div id="auth-msg" class="form-msg" role="alert"></div>
        <button class="btn primary btn-wide auth-submit" id="submit">${reg?'Создать профиль':'Войти'} ${icon('arrow')}</button>
      </form>
      <div class="auth-switch"><span>${reg?'Уже есть аккаунт?':'Впервые здесь?'}</span><button id="switch">${reg?'Войти':'Создать аккаунт'}</button></div>
      <div class="auth-foot"><span>${icon('spark')} Сделано для Твери</span><span>18+</span></div>
    </section></main>`
    const switchBtn=document.querySelector('#switch');switchBtn.onclick=()=>{mode=reg?'login':'register';draw()}
    const pw=document.querySelector('#password-toggle');pw?.addEventListener('click',()=>{const i=document.querySelector('[name=password]');i.type=i.type==='password'?'text':'password'})
    const username=document.querySelector('#username');let timer
    username?.addEventListener('input',()=>{clearTimeout(timer);const v=username.value.trim().toLowerCase();const state=document.querySelector('#username-state');state.className='username-state';state.textContent=v?'Проверяем…':'';timer=setTimeout(async()=>{if(!v)return;const r=await usernameAvailable(v);state.textContent=r.ok?'Свободен':'Занят';state.className=`username-state ${r.ok?'ok':'bad'}`},350)})
    document.querySelector('#auth-form').onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.currentTarget),b=document.querySelector('#submit'),msg=document.querySelector('#auth-msg');setBusy(b,true,'');msg.textContent=''
      try{let r;if(reg){const clean=fd.get('username').trim().toLowerCase();const check=await usernameAvailable(clean);if(!check.ok)throw Error(check.reason);r=await signUp({email:fd.get('email').trim(),password:fd.get('password'),full_name:fd.get('full_name').trim(),username:clean,age:Number(fd.get('age')),city:fd.get('city').trim()})}else r=await signIn(fd.get('email').trim(),fd.get('password'));if(r.error)throw r.error;if(reg&&!r.data.session){msg.textContent='Аккаунт создан. Если подтверждение email включено, проверь почту.';return}onSuccess?.()}catch(err){msg.textContent=err.message||'Не удалось выполнить действие'}finally{setBusy(b,false)}}
  }
  draw()
}
