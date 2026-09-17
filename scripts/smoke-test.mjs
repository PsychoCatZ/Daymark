import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const files = {
  html: new URL("../dist/index.html", import.meta.url),
  css: new URL("../dist/styles.css", import.meta.url),
  app: new URL("../dist/app.js", import.meta.url),
  server: new URL("./server.mjs", import.meta.url),
};

const [html, css, app] = await Promise.all([
  readFile(files.html, "utf8"),
  readFile(files.css, "utf8"),
  readFile(files.app, "utf8"),
]);

assert.match(html, /<main\b/iu, "В документе отсутствует семантический main");
assert.match(html, /<dialog\b/iu, "В документе отсутствуют рабочие диалоги");
assert.match(html, /<label\b/iu, "Формы должны иметь подписи");
assert.match(html, /\.\/styles\.css/iu, "Не подключены стили");
assert.match(html, /\.\/app\.js/iu, "Не подключён JavaScript");
assert.doesNotMatch(`${html}\n${app}`, /lorem ipsum|product 1|service 1/iu, "Найдены шаблонные заглушки");
assert.match(css, /@media \(max-width: 720px\)/u, "Нет мобильной адаптации");
assert.match(css, /:focus-visible/u, "Нет заметных focus-состояний");
assert.match(app, /localStorage/u, "Локальное сохранение состояния не реализовано");
assert.match(app, /registerWebMCPTools/u, "WebMCP-инструменты не зарегистрированы");

for (const file of [files.app, files.server]) {
  const syntax = spawnSync(process.execPath, ["--check", fileURLToPath(file)], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || `Ошибка синтаксиса в ${file.pathname}`);
}

const port = 4174;
const server = spawn(process.execPath, [fileURLToPath(files.server)], {
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
});

try {
  let response;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/`);
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(response, "Локальный сервер не запустился");
  assert.equal(response.status, 200, "Главная страница не отдаётся с кодом 200");
  assert.match(response.headers.get("content-type") || "", /text\/html/u, "Неверный Content-Type HTML");
  const servedHtml = await response.text();
  assert.match(servedHtml, /Daymark — планировщик дня/u, "Сервер отдаёт неверную страницу");

  for (const asset of ["styles.css", "app.js"]) {
    const assetResponse = await fetch(`http://127.0.0.1:${port}/${asset}`);
    assert.equal(assetResponse.status, 200, `Не загружается ${asset}`);
  }

  const missing = await fetch(`http://127.0.0.1:${port}/missing-page`);
  assert.equal(missing.status, 404, "Неизвестный путь должен возвращать 404");
} finally {
  server.kill();
}

console.log("✓ Структура, синтаксис, локальный запуск и статические ресурсы проверены");
