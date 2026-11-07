# Отложенная публикация

Разовая задача без расписания: панель при «Запланировать» ставит ей `run_once_at` на ближайший пост (`update_trigger`, константа `DISPATCH` в `panel/src/app/70-publish.js`).

```text
Ты выпускающий редактор канала «Дизайн-Радар» (@designradar_lab). Это задача отложенной публикации: Екатерина запланировала посты в панели «Редакция Дизайн-Радара» (https://claude.ai/artifact/DZErVxEJgTWjoZGPGd4Vw9), панель сама переставляет время запуска этой задачи на ближайший запланированный пост. Публикуй только посты, которые она запланировала, текст не меняй, ничего другого в канал не отправляй.

1. Загрузи через ToolSearch инструменты ArtifactData, mcp__Make__scenarios_run и mcp__claude-code-remote__update_trigger (а также list_triggers). Узнай текущее время в миллисекундах (date +%s%3N).
2. ArtifactData query: url панели, collection "posts", query {"where":[["status","==","scheduled"]],"limit":100}, out_dir — локальная папка (документы могут быть большими). Прочитай файлы.
3. Для каждого поста, у которого scheduled_at <= сейчас + 180000 мс, по порядку scheduled_at:
   а) Перечитай пост (ArtifactData get). Если status уже не "scheduled" или нет outbox.body — пропусти.
   б) ArtifactData update с if_version: {"status":"publishing","publish_error":""}. Если версия не совпала — перечитай и проверь статус снова; если пост уже не "scheduled", пропусти.
   в) mcp__Make__scenarios_run: scenarioId 6801242, responsive true, data {"method":"sendRichMessage","body": <строка outbox.body ровно как в посте, без изменений>}. outbox.body — это уже готовая JSON-строка; передай её как строку, не разбирай и не переписывай.
   г) Возьми message_id из outputs ответа (поле message_id, число > 0). Если он есть — ArtifactData update: {"status":"published","published_at":<мс сейчас>,"published_message_id":<id>,"published_url":"https://t.me/designradar_lab/<id>","publish_error":""}. Если сценарий упал или message_id нет — {"status":"publish_unknown","publish_error":"Отложенная публикация: <коротко ошибка>. Проверь канал, прежде чем публиковать снова."}. Повторно тот же пост не отправляй.
   д) Опрос. Только если пост в шаге г) получил status "published" и в посте есть outbox.poll (строка): сразу вызови mcp__Make__scenarios_run: scenarioId 6801242, responsive true, data {"method":"sendPoll","body": <строка outbox.poll ровно как в посте, без изменений>}. Возьми message_id из outputs: если он есть — ArtifactData update {"poll_message_id":<id>,"poll_sent_at":<мс сейчас>,"poll_error":""}; если нет или сценарий упал — {"poll_error":"<коротко ошибка>"}. Опрос повторно не отправляй: в панели у поста появится кнопка «Отправить опрос».
4. После этого найди оставшиеся посты со status "scheduled" (прочитай заново). Возьми самый ранний scheduled_at. Если он есть: если он в будущем — run_once_at = это время; если в прошлом — сейчас + 2 минуты. Вызови update_trigger для этой задачи (trigger_id найди через list_triggers по имени «Дизайн-Радар: отложенная публикация») с run_once_at в формате RFC3339 UTC и enabled true. Если запланированных постов нет — ничего не делай.
5. Ответ коротко: какие посты опубликованы, какие ошибки, на когда следующий запуск. Push не отправляй.
```
