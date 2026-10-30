#!/bin/bash
# Собирает панель из src/ в dist/ и прогоняет проверки. Публиковать только если всё зелёное.
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist
cat src/app/*.js > dist/app.js
cp src/render.js dist/render.js
cp src/styles.css dist/styles.css
{ cat src/head.html; echo '<link rel="stylesheet" href="styles.css">'; cat src/body.html; echo '<script src="render.js"></script>'; echo '<script src="app.js"></script>'; } > dist/index.html
node --check dist/render.js
node --check dist/app.js
# тестовая страница: та же сборка + заглушки claude.use() с копией настоящих постов
mkdir -p dist/_test && cp test/mockreal.js test/m2.png dist/_test/ && cp dist/*.js dist/styles.css dist/_test/
{ echo '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><script src="mockreal.js"></script></head><body>'; cat dist/index.html; echo '</body></html>'; } > dist/_test/index.html
node test/check.js dist/_test/index.html
rm -rf dist/_test
echo "BUILD OK: $(du -ch dist/* | tail -1 | cut -f1)"
