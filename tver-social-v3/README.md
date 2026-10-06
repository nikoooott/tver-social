# ТВЕРЬ Social 3.0

Полный visual/UX overhaul поверх Supabase-архитектуры проекта.

## Структура
- `src/main.js` — shell, navigation, search, theme, notifications
- `src/features/` — auth, feed, profile, messages
- `src/services/` — Supabase data/auth layer
- `src/lib/` — UI primitives, icons, avatars, modal/toast helpers
- `supabase.sql` — additive/idempotent migration for the existing database

## Важно
Не удаляй существующие данные Supabase. `supabase.sql` рассчитан на существующий проект и добавляет нужные поля/таблицы/политики.

Перед публикацией:
1. Проверь `VITE_SUPABASE_URL`.
2. Проверь `VITE_SUPABASE_ANON_KEY`.
3. Выполни `supabase.sql` в Supabase SQL Editor.
4. Замени код в GitHub и дождись деплоя Vercel.

## Основные UX-фишки
- Новый desktop/mobile shell
- Light/Dark mode
- Уникальный `@username` отдельно от отображаемого имени
- Детерминированные fallback-аватары
- Feed tabs: для вас / подписки / популярное
- Double-tap по фото для лайка
- Animated likes/bookmarks
- Modern comments sheet
- Media viewer
- Composer с несколькими фото и preview/remove
- Search с debounce и preview
- Notifications + unread badge
- Bookmarks
- Profile redesign + media/about tabs
- Realtime messages + typing broadcast
- Online/last seen indicator
- Skeleton/empty/error states
- Reduced-motion support
