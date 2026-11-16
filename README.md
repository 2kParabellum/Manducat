# Manducat

Пошаговая карточная игра на поле 6×6 для двух игроков: открытия, взятия «как ладья», персонажи со способностями. Режимы — против ИИ (3 уровня) и вдвоём за одним экраном.

## Запуск

```
npm install
npm run dev       # http://localhost:5173
```

Сборка: `npm run build` → `apps/client/dist` (статические файлы для веб-сервера). `npm run build:single` → `apps/client/dist-single/index.html` — всё в одном файле.

## Разработка

- `npm test` — тесты правил, вида игрока и ботов
- `npm run typecheck` — проверка типов
- `npm run sim -- --games 20 --a normal:miner --b normal:jack` — турнир ботов для балансировки

Устройство проекта и планы — в [ARCHITECTURE.md](ARCHITECTURE.md).
