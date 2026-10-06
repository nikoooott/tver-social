# ТВЕРЬ Social 2.0

Vercel-ready MVP социальной сети Твери.

## 1. Supabase
Создай проект в Supabase, открой SQL Editor и запусти весь файл `supabase.sql`.

После этого возьми:
- Project URL
- anon/public key

## 2. Локально
```bash
npm install
cp .env.example .env
npm run dev
```

В `.env` вставь URL и anon key.

## 3. Vercel
Подключи GitHub-репозиторий.
Build Command: `npm run build`
Output Directory: `dist`

В Vercel -> Project Settings -> Environment Variables добавь:
`VITE_SUPABASE_URL`
`VITE_SUPABASE_ANON_KEY`

После этого сделай Redeploy.

## Что уже есть
- современная лента;
- регистрация/вход через Supabase Auth;
- профили;
- публикации;
- лайки;
- комментарии;
- подписки (таблица и RLS готовы);
- поиск по ленте;
- адаптация под телефон;
- Storage bucket для фотографий;
- городские тренды и люди.

Демо-посты отображаются до появления реальных публикаций.
