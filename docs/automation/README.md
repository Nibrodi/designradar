# Задачи по расписанию

Полные инструкции (промпты) задач Claude. Чтобы пересоздать задачу: попроси Claude «создай задачу по расписанию <название>, расписание <cron>, инструкция — из файла docs/automation/<файл>», подставив свои ссылку панели, id регламента и id сценариев Make.

Константы нашей установки:
- Панель: `https://claude.ai/artifact/DZErVxEJgTWjoZGPGd4Vw9`
- Регламент (Claude Docs): `J3u5X8BL4ZHyQHzuB6HKzZ`
- Make: утилита Telegram 6801242, обложка 6749993, фото по URL 6801221, хранилище 178568
- Служебный чат для загрузки фото: 26530591

| Файл | Задача | id | Расписание (МСК) |
|---|---|---|---|
| [stock.md](stock.md) | Запас постов в панели | trig_01Wi3nfDWb5VVTw5kXbNg5gi | `41 9-21 * * *` |
| [thought.md](thought.md) | Короткая мысль | trig_01EqNBWJw9jSiVaDHaXGeKfa | `17 12,20 * * *` |
| [lessons.md](lessons.md) | Уроки из правок Екатерины | trig_01GQeZMjLGweegHgik9EhLo6 | `13 22 * * *` |
| [dispatch.md](dispatch.md) | Отложенная публикация | trig_01WWyd17PvLVN5jSuiwHkRwb | разово, время ставит панель |
| [editors-publish.md](editors-publish.md) | Публикация постов редакторов | trig_018ctQyYNe555bBXT6btDnTU | `7 8-23 * * *` |
| [slot-10.md](slot-10.md) | Пост 10:00, новость | trig_014mHhHxwN1g9wc6ysAMnYwH | `38 9 * * 1-5` |
| [slot-14.md](slot-14.md) | Пост 14:00, разбор или ремесло | trig_01LGMMerhDryo5f6SHio6xpc | `38 13 * * 1-6` |
| [slot-16.md](slot-16.md) | Пост 16:00, вакансии дня | trig_016Wo8CYmLJd654z3KdfKzgS | `38 15 * * 1,3,5` |
| [slot-18.md](slot-18.md) | Пост 18:00, вечерний формат | trig_01TGpj2GTsAb47oFK3oQLJNU | `38 17 * * *` |
| [weekly.md](weekly.md) | Недельная проверка канала | trig_01CDVedTtJYbA13bwjqLq7ss | `47 11 * * 1` |
| [insight-reminder.md](insight-reminder.md) | Напоминание о голосе автора | trig_01SWki2RYvJiQVeQ4gVVBgFq | `23 12 * * 2` |

Не используются (можно выключить): «Публикация поста из панели» (trig_015jMNCGYWvjDN6b5s8MGi3R) и «Проверка связи с Telegram» (trig_01KD4THKcE9YDoU1c56iqZc7) — им нужен токен в окружении, которого нет.

Расписание пишется как `CRON_TZ=Europe/Moscow <поля>`. Минуты не круглые, чтобы не попадать в общую очередь на :00.
