# Табло отправлений Astra Marine

MVP-версия электронного табло отправлений для причала.

## Как запустить

```bash
npm install
npm run dev
```

## Как подключить Google Sheets

### 1. Загрузи Excel в Google Sheets

Файл → Импорт → Загрузить.

### 2. Опубликуй таблицу как CSV

Файл → Поделиться → Опубликовать в интернете.

Дальше выбери:

- нужный лист;
- формат: `CSV`;
- нажми «Опубликовать».

Google даст ссылку примерно такого вида:

```text
https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=0&single=true&output=csv
```

### 3. Вставь ссылку в код

Открой файл:

```text
src/main.jsx
```

Найди строку:

```js
const GOOGLE_SHEETS_CSV_URL = ''
```

И вставь ссылку между кавычками:

```js
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=0&single=true&output=csv'
```

После этого табло будет читать Google Sheets.

## Важно по колонкам

В Google Sheets должны быть такие заголовки:

```text
pier_id, pier_name, date, time, category, route, ship, manual_status, note, is_active
```

## Категории

- `meteor` — метеоры
- `cruise` — прогулочные рейсы
- `restaurant` — ресторанные рейсы
- `music` — музыкальные рейсы
- `night` — ночные рейсы

## Ручные статусы

Если поле `manual_status` пустое, статус считается автоматически.

Можно вручную указать:

- `delay` — задержка
- `cancelled` — отменён
- `boarding` — посадка
- `last_call` — последний вызов
- `departed` — отправлен

## Как работает автообновление

- раз в 60 секунд табло заново читает Google Sheets;
- раз в 15 секунд обновляет текущее время;
- статусы считаются автоматически по времени отправления.

## Резервный режим

Если `GOOGLE_SHEETS_CSV_URL` пустой, табло читает файл:

```text
public/departures.json
```
