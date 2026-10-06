import { createClient } from '@supabase/supabase-js'
import './style.css'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const app = document.querySelector('#app')

if (!URL || !KEY) {
  app.innerHTML = `
    <main class="center-page">
      <section class="error-card">
        <div class="logo-mark">Т</div>
        <h1>ТВЕРЬ Social</h1>
        <p>Supabase ещё не подключён к сборке.</p>
        <small>Проверь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Vercel → Settings → Environment Variables, затем сделай Redeploy.</small>
      </section>
    </main>`
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(URL, KEY)
let user = null
let profile = null
let currentView = 'feed'
let searchTimer

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const initials = (name = 'Пользователь') =>
  name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'Т'

const avatar = (p, size = '') =>
  p?.avatar_url
    ? `<img class="avatar ${size}" src="${esc(p.avatar_url)}" alt="">`
    : `<div class="avatar ${size}">${esc(initials(p?.full_name || p?.username))}</div>`

function timeAgo(date) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин.`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч.`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} дн.`
  return new Date(date).toLocaleDateString('ru-RU')
}

function shell(content) {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button class="brand" data-nav="feed"><span class="brand-icon">Т</span><span>ТВЕРЬ</span></button>
        <div class="top-search">
          <span>⌕</span><input id="globalSearch" placeholder="Поиск людей и публикаций">
        </div>
        <nav class="top-actions">
          <button class="icon-btn" data-nav="notifications" title="Уведомления">♡</button>
          <button class="profile-mini" data-nav="profile">${avatar(profile, 'sm')}<span>${esc(profile?.full_name || profile?.username || 'Профиль')}</span></button>
          <button class="logout-btn" id="logout">Выйти</button>
        </nav>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <button class="nav-item ${currentView === 'feed' ? 'active' : ''}" data-nav="feed">⌂ <span>Лента</span></button>
          <button class="nav-item ${currentView === 'search' ? 'active' : ''}" data-nav="search">⌕ <span>Поиск</span></button>
          <button class="nav-item ${currentView === 'bookmarks' ? 'active' : ''}" data-nav="bookmarks">▱ <span>Закладки</span></button>
          <button class="nav-item ${currentView === 'notifications' ? 'active' : ''}" data-nav="notifications">♡ <span>Уведомления</span></button>
          <button class="nav-item ${currentView === 'profile' ? 'active' : ''}" data-nav="profile">◎ <span>Мой профиль</span></button>
        </aside>
        <main class="main">${content}</main>
      </div>
    </div>`
  bindShell()
}

function bindShell() {
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)))
  document.querySelector('#logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
  })
  document.querySelector('#globalSearch')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim()
      if (q) {
        currentView = 'search'
        renderSearch(q)
      }
    }
  })
}

async function navigate(view) {
  currentView = view
  if (view === 'feed') return renderFeed()
  if (view === 'profile') return renderProfile(user.id)
  if (view === 'bookmarks') return renderBookmarks()
  if (view === 'notifications') return renderNotifications()
  return renderSearch('')
}

function authPage(mode = 'login') {
  const register = mode === 'register'
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <div class="logo-mark">Т</div>
        <h1>ТВЕРЬ Social</h1>
        <p class="muted">${register ? 'Создай свой профиль Твери' : 'Социальная сеть твоего города'}</p>
        <form id="authForm">
          ${register ? `
            <label>Имя<input name="full_name" required maxlength="60" placeholder="Например, Нико"></label>
            <label>Возраст<input name="age" type="number" min="13" max="120" required placeholder="18"></label>
            <label>Никнейм<input name="username" required maxlength="30" pattern="[A-Za-zА-Яа-я0-9_.-]{3,30}" placeholder="niko"></label>
          ` : ''}
          <label>Email<input name="email" type="email" required placeholder="you@example.com"></label>
          <label>Пароль<input name="password" type="password" minlength="6" required placeholder="Минимум 6 символов"></label>
          <button class="primary-btn" type="submit">${register ? 'Создать аккаунт' : 'Войти'}</button>
        </form>
        <div id="authMessage" class="message"></div>
        <button class="link-btn" id="switchAuth">${register ? 'У меня уже есть аккаунт' : 'Создать новый аккаунт'}</button>
      </section>
    </main>`

  document.querySelector('#switchAuth').onclick = () => authPage(register ? 'login' : 'register')
  document.querySelector('#authForm').onsubmit = async e => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email').trim()
    const password = fd.get('password')
    const message = document.querySelector('#authMessage')
    message.textContent = 'Подождите…'

    if (!register) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      message.textContent = error ? error.message : ''
      return
    }

    const full_name = fd.get('full_name').trim()
    const username = fd.get('username').trim().toLowerCase()
    const age = Number(fd.get('age'))

    const taken = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
    if (taken.data) {
      message.textContent = 'Этот никнейм уже занят.'
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name, username, age } }
    })
    if (error) {
      message.textContent = error.message
      return
    }

    if (data.user && data.session) {
      await supabase.from('profiles').upsert({ id: data.user.id, full_name, username, age })
      message.textContent = 'Аккаунт создан.'
    } else {
      message.textContent = 'Проверь почту и подтверди адрес. После подтверждения вернись сюда и войди.'
    }
  }
}

async function ensureProfile() {
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (p) return p

  const meta = user.user_metadata || {}
  const fallback = {
    id: user.id,
    full_name: meta.full_name || user.email?.split('@')[0] || 'Пользователь',
    username: meta.username || `user_${user.id.slice(0, 8)}`,
    age: Number(meta.age) || null
  }
  const { data, error } = await supabase.from('profiles').upsert(fallback).select().single()
  if (error) throw error
  return data
}

function postCard(post, likeIds = new Set(), bookmarkIds = new Set()) {
  const liked = likeIds.has(post.id)
  const bookmarked = bookmarkIds.has(post.id)
  const own = post.user_id === user.id
  const author = post.profiles || {}
  return `
    <article class="post-card" data-post="${post.id}">
      <div class="post-head">
        <button class="user-link" data-user="${post.user_id}">${avatar(author, 'sm')}<span><b>${esc(author.full_name || author.username || 'Пользователь')}</b><small>@${esc(author.username || 'user')} · ${timeAgo(post.created_at)}</small></span></button>
        ${own ? `<button class="more-btn" data-delete="${post.id}" title="Удалить">•••</button>` : ''}
      </div>
      ${post.content ? `<div class="post-text">${esc(post.content).replaceAll('\n', '<br>')}</div>` : ''}
      ${post.image_url ? `<img class="post-image" src="${esc(post.image_url)}" alt="Публикация">` : ''}
      <div class="post-actions">
        <button class="${liked ? 'active' : ''}" data-like="${post.id}">♥ <span class="like-count">${post.like_count || 0}</span></button>
        <button data-comments="${post.id}">◯ <span>${post.comment_count || 0}</span></button>
        <button class="${bookmarked ? 'active' : ''}" data-bookmark="${post.id}">▱</button>
      </div>
      <div class="comments" id="comments-${post.id}"></div>
    </article>`
}

async function getPosts(extra = {}) {
  let q = supabase.from('posts')
    .select('*, profiles(id,username,full_name,avatar_url)')
    .order('created_at', { ascending: false })
    .limit(30)
  if (extra.userId) q = q.eq('user_id', extra.userId)
  if (extra.ids) q = q.in('id', extra.ids)
  const { data, error } = await q
  if (error) throw error
  if (!data?.length) return []

  const ids = data.map(p => p.id)
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('likes').select('post_id,user_id').in('post_id', ids),
    supabase.from('comments').select('post_id').in('post_id', ids)
  ])
  const counts = Object.fromEntries(ids.map(id => [id, { likes: 0, comments: 0 }]))
  ;(likes || []).forEach(x => counts[x.post_id].likes++)
  ;(comments || []).forEach(x => counts[x.post_id].comments++)
  return data.map(p => ({ ...p, like_count: counts[p.id].likes, comment_count: counts[p.id].comments }))
}

async function getMyLikeIds(posts) {
  if (!posts.length) return new Set()
  const { data } = await supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', posts.map(x => x.id))
  return new Set((data || []).map(x => x.post_id))
}

async function getMyBookmarkIds(posts) {
  if (!posts.length) return new Set()
  const { data } = await supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', posts.map(x => x.id))
  return new Set((data || []).map(x => x.post_id))
}

function feedComposer() {
  return `
    <section class="composer card">
      <div class="composer-top">${avatar(profile, 'sm')}<textarea id="postText" maxlength="2000" placeholder="Что нового в Твери?"></textarea></div>
      <div id="imagePreview"></div>
      <div class="composer-bottom">
        <label class="attach">＋ Фото<input id="postImage" type="file" accept="image/*" hidden></label>
        <span class="muted">до 10 МБ</span>
        <button class="primary-btn small" id="publish">Опубликовать</button>
      </div>
    </section>`
}

async function renderFeed() {
  shell(`<div class="page-title"><div><h2>Лента</h2><p>Публикации жителей Твери</p></div></div>${feedComposer()}<div id="feedList"><div class="loading">Загрузка публикаций…</div></div>`)
  bindComposer()
  try {
    const posts = await getPosts()
    const [likes, bookmarks] = await Promise.all([getMyLikeIds(posts), getMyBookmarkIds(posts)])
    const list = document.querySelector('#feedList')
    list.innerHTML = posts.length
      ? posts.map(p => postCard(p, likes, bookmarks)).join('')
      : `<div class="empty card"><b>Пока здесь пусто</b><span>Будь первым, кто опубликует что-нибудь.</span></div>`
    bindPosts()
  } catch (e) {
    document.querySelector('#feedList').innerHTML = `<div class="empty card"><b>Не удалось загрузить ленту</b><span>${esc(e.message)}</span></div>`
  }
}

function bindComposer() {
  const file = document.querySelector('#postImage')
  file?.addEventListener('change', () => {
    const f = file.files?.[0]
    document.querySelector('#imagePreview').innerHTML = f ? `<div class="selected-file">📷 ${esc(f.name)}</div>` : ''
  })
  document.querySelector('#publish')?.addEventListener('click', publishPost)
}

async function publishPost() {
  const text = document.querySelector('#postText').value.trim()
  const file = document.querySelector('#postImage').files?.[0]
  if (!text && !file) return alert('Добавь текст или фотографию.')

  const button = document.querySelector('#publish')
  button.disabled = true
  button.textContent = 'Публикуем…'
  let image_url = null

  try {
    if (file) {
      if (file.size > 10 * 1024 * 1024) throw new Error('Файл больше 10 МБ.')
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: false })
      if (error) throw error
      image_url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.from('posts').insert({ user_id: user.id, content: text, image_url })
    if (error) throw error
    await renderFeed()
  } catch (e) {
    alert(e.message)
    button.disabled = false
    button.textContent = 'Опубликовать'
  }
}

function bindPosts() {
  document.querySelectorAll('[data-like]').forEach(btn => btn.onclick = () => toggleLike(btn.dataset.like))
  document.querySelectorAll('[data-bookmark]').forEach(btn => btn.onclick = () => toggleBookmark(btn.dataset.bookmark))
  document.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = () => deletePost(btn.dataset.delete))
  document.querySelectorAll('[data-comments]').forEach(btn => btn.onclick = () => toggleComments(btn.dataset.comments))
  document.querySelectorAll('[data-user]').forEach(btn => btn.onclick = () => renderProfile(btn.dataset.user))
}

async function toggleLike(postId) {
  const { data } = await supabase.from('likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
  if (data) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
  else {
    await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    const { data: p } = await supabase.from('posts').select('user_id').eq('id', postId).single()
    if (p && p.user_id !== user.id) await supabase.from('notifications').insert({ user_id: p.user_id, actor_id: user.id, type: 'like', post_id: postId })
  }
  await renderFeed()
}

async function toggleBookmark(postId) {
  const { data } = await supabase.from('bookmarks').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
  if (data) await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id)
  else await supabase.from('bookmarks').insert({ post_id: postId, user_id: user.id })
  await renderFeed()
}

async function deletePost(id) {
  if (!confirm('Удалить эту публикацию?')) return
  const { error } = await supabase.from('posts').delete().eq('id', id).eq('user_id', user.id)
  if (error) alert(error.message)
  else await renderFeed()
}

async function toggleComments(postId) {
  const box = document.querySelector(`#comments-${postId}`)
  if (!box) return
  if (box.dataset.open) {
    box.innerHTML = ''
    delete box.dataset.open
    return
  }
  box.dataset.open = '1'
  box.innerHTML = `<div class="loading">Загрузка комментариев…</div>`
  const { data, error } = await supabase.from('comments').select('*, profiles(username,full_name,avatar_url)').eq('post_id', postId).order('created_at', { ascending: true }).limit(50)
  if (error) return box.innerHTML = `<small>${esc(error.message)}</small>`
  box.innerHTML = `
    ${(data || []).map(c => `<div class="comment">${avatar(c.profiles, 'xs')}<div><b>${esc(c.profiles?.full_name || c.profiles?.username || 'Пользователь')}</b><span>${esc(c.content)}</span></div></div>`).join('')}
    <form class="comment-form"><input maxlength="500" placeholder="Написать комментарий…"><button>Отправить</button></form>`
  box.querySelector('form').onsubmit = async e => {
    e.preventDefault()
    const input = e.currentTarget.querySelector('input')
    const content = input.value.trim()
    if (!content) return
    const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: user.id, content })
    if (error) alert(error.message)
    else await toggleComments(postId)
  }
}

async function renderProfile(id) {
  const { data: p, error } = await supabase.from('profiles').select('*').eq('id', id).single()
  if (error) return shell(`<div class="empty card">Профиль не найден.</div>`)
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id)
  ])
  const { data: followingRow } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', id).maybeSingle()
  const own = id === user.id
  shell(`
    <section class="profile-card card">
      <div class="profile-main">${avatar(p, 'xl')}<div><h1>${esc(p.full_name || p.username)}</h1><div class="handle">@${esc(p.username || 'user')}</div><p>${esc(p.bio || '')}</p></div></div>
      <div class="profile-stats"><b>${followers || 0}<span>подписчиков</span></b><b>${following || 0}<span>подписок</span></b></div>
      <div class="profile-actions">
        ${own ? `<button class="primary-btn" id="editProfile">Редактировать профиль</button>` : `<button class="${followingRow ? 'secondary-btn' : 'primary-btn'}" id="follow">${followingRow ? 'Вы подписаны' : 'Подписаться'}</button>`}
      </div>
    </section>
    <div class="section-heading"><h2>Публикации</h2></div>
    <div id="profilePosts"><div class="loading">Загрузка…</div></div>`)

  if (own) document.querySelector('#editProfile').onclick = () => editProfile(p)
  if (!own) document.querySelector('#follow').onclick = async () => {
    if (followingRow) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
    else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
      await supabase.from('notifications').insert({ user_id: id, actor_id: user.id, type: 'follow' })
    }
    renderProfile(id)
  }

  const posts = await getPosts({ userId: id })
  const [likes, bookmarks] = await Promise.all([getMyLikeIds(posts), getMyBookmarkIds(posts)])
  document.querySelector('#profilePosts').innerHTML = posts.length
    ? posts.map(p => postCard(p, likes, bookmarks)).join('')
    : `<div class="empty card">Публикаций пока нет.</div>`
  bindPosts()
}

function editProfile(p) {
  const modal = document.createElement('div')
  modal.className = 'modal-wrap'
  modal.innerHTML = `
    <div class="modal card"><button class="close" id="close">×</button><h2>Редактировать профиль</h2>
      <label>Имя<input id="name" maxlength="60" value="${esc(p.full_name || '')}"></label>
      <label>О себе<textarea id="bio" maxlength="300">${esc(p.bio || '')}</textarea></label>
      <label>Аватар<input id="avatar" type="file" accept="image/*"></label>
      <button class="primary-btn" id="save">Сохранить</button><div id="saveMsg"></div>
    </div>`
  document.body.appendChild(modal)
  modal.querySelector('#close').onclick = () => modal.remove()
  modal.querySelector('#save').onclick = async () => {
    const button = modal.querySelector('#save')
    button.disabled = true
    let avatar_url = p.avatar_url
    const file = modal.querySelector('#avatar').files?.[0]
    try {
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Аватар больше 5 МБ.')
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/avatar-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true })
        if (error) throw error
        avatar_url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
      }
      const { error } = await supabase.from('profiles').update({
        full_name: modal.querySelector('#name').value.trim(),
        bio: modal.querySelector('#bio').value.trim(),
        avatar_url
      }).eq('id', user.id)
      if (error) throw error
      profile = await ensureProfile()
      modal.remove()
      renderProfile(user.id)
    } catch (e) {
      modal.querySelector('#saveMsg').textContent = e.message
      button.disabled = false
    }
  }
}

async function renderBookmarks() {
  shell(`<div class="page-title"><div><h2>Закладки</h2><p>Сохранённые публикации</p></div></div><div id="bookmarkList"><div class="loading">Загрузка…</div></div>`)
  const { data } = await supabase.from('bookmarks').select('post_id').eq('user_id', user.id).order('created_at', { ascending: false })
  const ids = (data || []).map(x => x.post_id)
  const posts = ids.length ? await getPosts({ ids }) : []
  const [likes, bookmarks] = await Promise.all([getMyLikeIds(posts), getMyBookmarkIds(posts)])
  document.querySelector('#bookmarkList').innerHTML = posts.length
    ? posts.map(p => postCard(p, likes, bookmarks)).join('')
    : `<div class="empty card"><b>Нет сохранённых публикаций</b><span>Нажимай ▱ под понравившимися постами.</span></div>`
  bindPosts()
}

async function renderNotifications() {
  shell(`<div class="page-title"><div><h2>Уведомления</h2><p>Что происходит с твоим профилем</p></div></div><div id="notifications"><div class="loading">Загрузка…</div></div>`)
  const { data, error } = await supabase.from('notifications').select('*, profiles:actor_id(username,full_name,avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  if (error) return document.querySelector('#notifications').innerHTML = `<div class="empty card">${esc(error.message)}</div>`
  document.querySelector('#notifications').innerHTML = data?.length
    ? data.map(n => `<div class="notification card">${avatar(n.profiles, 'sm')}<div><b>${esc(n.profiles?.full_name || n.profiles?.username || 'Пользователь')}</b> ${n.type === 'like' ? 'поставил(а) лайк вашей публикации' : 'подписался(ась) на вас'}<small>${timeAgo(n.created_at)}</small></div></div>`).join('')
    : `<div class="empty card"><b>Пока ничего нового</b><span>Здесь появятся лайки и новые подписчики.</span></div>`
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
}

async function renderSearch(q) {
  shell(`<div class="page-title"><div><h2>Поиск</h2><p>${q ? `Результаты для «${esc(q)}»` : 'Найди людей или публикации'}</p></div></div><div id="searchResults">${q ? '<div class="loading">Поиск…</div>' : '<div class="empty card">Введи запрос в строку сверху.</div>'}</div>`)
  if (!q) return
  const [{ data: people }, { data: posts }] = await Promise.all([
    supabase.from('profiles').select('*').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(10),
    supabase.from('posts').select('*, profiles(id,username,full_name,avatar_url)').ilike('content', `%${q}%`).order('created_at', { ascending: false }).limit(20)
  ])
  const results = document.querySelector('#searchResults')
  results.innerHTML = `
    <div class="search-section"><h3>Люди</h3>${people?.length ? people.map(p => `<button class="person-result card" data-user="${p.id}">${avatar(p, 'sm')}<span><b>${esc(p.full_name || p.username)}</b><small>@${esc(p.username || '')}</small></span></button>`).join('') : '<div class="empty card">Никого не нашли.</div>'}</div>
    <div class="search-section"><h3>Публикации</h3>${posts?.length ? posts.map(p => postCard(p)).join('') : '<div class="empty card">Публикаций не найдено.</div>'}</div>`
  document.querySelectorAll('[data-user]').forEach(b => b.onclick = () => renderProfile(b.dataset.user))
  bindPosts()
}

supabase.auth.onAuthStateChange(async (_event, session) => {
  user = session?.user || null
  if (!user) return authPage('login')
  try {
    profile = await ensureProfile()
    await renderFeed()
  } catch (e) {
    app.innerHTML = `<main class="center-page"><section class="error-card"><h2>Не удалось загрузить профиль</h2><p>${esc(e.message)}</p><button class="primary-btn" onclick="location.reload()">Обновить</button></section></main>`
  }
})

const { data: { session } } = await supabase.auth.getSession()
if (!session) authPage('login')
