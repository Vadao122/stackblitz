# agent.md — аудит проекта

> **Дата аудита:** 2026-10-29  
> **Первичная проверка:** статический анализ; Node.js в окружении не было, запуск не выполнялся.  
> **Проверка исправлений:** 2026-10-31, Node.js 22.20.0; `npm test`, `npm run db:migrate` и smoke-тест CRUD пройдены.  
> **Статус:** разделы 1–12 — исходный аудит. Актуальное состояние — в разделе 13.

## 0. Резюме

Проект представляет собой учебный REST API для учёта предметов (`item`) с иерархией
`structure → floor → room → place → location` и категориями. Стек: Koa 3, `@koa/router`,
`koa-bodyparser`, `sqlite3`, ESM.

Главные проблемы:

1. **Сервер не стартует** из-за неверных импортов и обращений к необъявленным переменным.
2. **Слой SQLite полностью нерабочий**: дублирующийся импорт, потеря `this` в промисах,
   отсутствие подключения к БД.
3. **Миграция не запускается** и содержит противоречия в схеме.
4. **HTTP-маршруты не соответствуют REST-конвенциям из `readme.md`**: создание и удаление
   сделаны через `PATCH`, удаление перекрыто другим маршрутом.
5. **Валидация сломана**: `isNotEmpty` всегда возвращает `true`, `isEmpty` — всегда `false`.
6. **Нет тестов, `start`-скрипта и рабочего миграционного раннера.**

### Светофор

| Область | Статус | Комментарий |
|---|---|---|
| Запуск сервера | ❌ | Ошибки ESM-импортов и `itemRouter` |
| Подключение к БД | ❌ | `SqliteLinker` не подключён, `this` потерян |
| Миграции | ❌ | `createDB()` не вызывается, схема противоречива |
| CRUD | ❌ | Падает на импортах, валидации и SQL |
| Валидация | ❌ | Утилиты всегда дают неверный результат |
| Тесты | ❌ | `npm test` — заглушка с `exit 1` |
| Документация | ⚠️ | `readme.md` — общий конспект, а не документация проекта |

## 1. Что это за проект

### 1.1 Стек

- Node.js, ESM (`"type": "module"`);
- Koa `3.2.1`;
- `@koa/router` `15.7.0`;
- `koa-bodyparser` `4.4.1`;
- `sqlite3` `6.0.1`;
- StackBlitz starter.

По `package-lock.json` зависимости требуют:

- `sqlite3@6` — Node `>=20.17.0`;
- `@koa/router@15` — Node `>=20`.

При этом в `package.json` нет поля `engines`, а `koa-bodyparser@4.4.1` — старая версия,
совместимость с Koa 3 отдельно не заявлена. Это риск при запуске на другом окружении.

### 1.2 Назначение

Судя по схеме и названиям:

- `structure` — здание/сооружение;
- `floor` — этаж;
- `room` — помещение;
- `place` — место;
- `location` — конкретная локация;
- `category` — дерево категорий;
- `item` — предмет, привязанный к локации и категории, с мягким удалением и статусом.

### 1.3 Текущее состояние

- Нет `start`/`dev`-скрипта, поэтому стандартный запуск StackBlitz, скорее всего, не сработает.
- Нет команды запуска миграции.
- Нет тестов.
- `index.js` не подключает роутер.
- `db/sqlite.js` не может загрузиться из-за синтаксической ошибки.
- Даже если исправить импорты, сервис не открывает соединение с БД.
- API не соответствует описанным в `readme.md` правилам.

## 2. Целевой запуск

Сейчас этих команд нет; их нужно добавить.

```bash
# Node >= 20.17
npm install
npm run db:migrate
npm run dev
```

Предлагаемые скрипты в `package.json`:

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "db:migrate": "node db/migrations/run.js",
    "test": "node --test"
  }
}
```

Переменные окружения:

```env
PORT=3000
DB_PATH=./database.db
```

Для миграций нужен отдельный раннер (`db/migrations/run.js`), который:

1. открывает одно соединение;
2. включает `PRAGMA foreign_keys = ON`;
3. выполняет миграции в транзакции;
4. записывает применённые версии в таблицу `schema_migrations`;
5. закрывает соединение в `finally`.

## 3. Карта файлов

| Файл | Роль | Состояние |
|---|---|---|
| `index.js` | Точка входа Koa | Сломанные импорты, роутер не подключён |
| `enums.js` | Статусы предметов | Работает, но не используется в схеме |
| `utils.js` | Проверки типов/пустоты | Логика `isEmpty`/`isNotEmpty` сломана |
| `item/item-router.js` | Маршруты `/items` | Неверный путь импорта, неверные HTTP-методы |
| `item/item-controller.js` | HTTP-слой | Неверные импорты, логика создания/обновления |
| `item/item-service.js` | Бизнес-логика и SQL | Нет подключения к БД, опечатки, неверный INSERT |
| `item/item-entity.js` | Сущность предмета | Пустой файл |
| `db/sqlite.js` | Обёртка над sqlite3 | Дублирующийся импорт, потеря `this` |
| `db/migration.js` | Хелпер миграций | `down()` сломан, соединение на каждый запрос |
| `db/migrations/23-09-2026-create-db.js` | Создание схемы | Не вызывается, порядок таблиц и ограничения сломаны |
| `db/dtos/floor.dto.js` | DTO этажа | Не хватает импортов, не используется |
| `db/dtos/structure.dto.js` | DTO структуры | Поле `address` не совпадает со схемой |
| `readme.md` | Конспект по REST | Нет инструкции по проекту |
| `package.json` | Зависимости | Нет `start`/`dev`/`migrate`, тест-заглушка |
| `.gitignore` | Игнорирование файлов | Не игнорирует `database.db` |

### 3.1 Поток запроса

Целевой поток:

```text
HTTP → router → controller (валидация/DTO) → service (бизнес-логика) → sqlite wrapper → SQLite
```

Текущий фактический поток:

```text
index.js (ошибка импорта)
  → item-router.js (неверный путь)
    → item-controller.js (неверные импорты)
      → item-service.js (нет соединения)
        → sqlite.js (синтаксическая ошибка)
```

## 4. Схема БД

### 4.1 Текущая схема

Порядок создания в `db/migrations/23-09-2026-create-db.js`:

1. `structure(id, name)`
2. `floor(id, name, structure_id)`
3. `category(id, name, parent_id)`
4. `item(id, is_deleted, name, properties, status, location_id, curent_location_id, category_id)`
5. `room(id, name, floor_id)`
6. `place(id, name, room_id)`
7. `location(id, name, place_id)`

Связи:

- `floor.structure_id → structure.id` (`ON DELETE CASCADE`);
- `room.floor_id → floor.id` (`ON DELETE CASCADE`);
- `place.room_id → room.id` (`ON DELETE CASCADE`);
- `location.place_id → place.id` (`ON DELETE CASCADE`);
- `category.parent_id → category.id` (`ON DELETE SET NULL`);
- `item.location_id → location.id`;
- `item.curent_location_id → location.id`;
- `item.category_id → category.id`.

### 4.2 Проблемы схемы

1. **Неправильный порядок создания.** `item` создаётся до `location`, `room` и `place`.
   SQLite может создать таблицу с ссылкой на несуществующую таблицу, но вставка/удаление
   с включёнными внешними ключами будут падать.
2. **`category.parent_id NOT NULL` + `ON DELETE SET NULL`.** Это противоречие: при удалении
   родителя дочерняя запись должна получить `NULL`, но колонка этого не разрешает. Кроме того,
   нельзя создать корневую категорию.
3. **`is_deleted boolean` без `NOT NULL` и `DEFAULT`.** У старых строк будет `NULL`,
   фильтрация `is_deleted = 0` их не найдёт.
4. **`properties jsonb`.** В SQLite нет отдельного типа `jsonb`; колонка получит NUMERIC
   affinity. Хранить JSON нужно в `TEXT` и сериализовать через `JSON.stringify`.
5. **Опечатка `curent_location_id`.** В коде одновременно встречаются `curent_location_id`
   и `current_location_id`.
6. **`structure` не содержит `address`**, хотя `StructureDto` ожидает это поле.
7. **Нет `created_at`/`updated_at`.**
8. **Нет индексов по внешним ключам** (`location_id`, `category_id`, `parent_id` и т. д.).
9. **Нет `CHECK` для статуса** — в БД можно записать любое значение.
10. **Нет уникальных ограничений** — можно создать две одинаковые структуры/категории.
11. **`item` ссылается на `location` без `ON DELETE`.** По умолчанию это `RESTRICT`:
    удаление локации с предметами будет блокироваться.
12. **Каскадное удаление структуры может не дойти до предметов:** цепочка
    `structure → floor → room → place → location` каскадная, а `item → location` — нет.
13. **`PRAGMA foreign_keys = ON` не сохраняется между соединениями.** Он выполняется
    в `up()` на отдельном соединении, которое сразу закрывается; приложение этот PRAGMA
    не включает.
14. **Нет миграционного учёта.** `CREATE TABLE IF NOT EXISTS` не позволяет понять,
    какие миграции уже применены, и не поддерживает `ALTER TABLE`.

### 4.3 Предлагаемая схема

Это предложение, а не текущее состояние. Перед применением нужно подтвердить доменные
вопросы из раздела 10.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS structure (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS floor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  structure_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (structure_id) REFERENCES structure(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  floor_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (floor_id) REFERENCES floor(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS place (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  room_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES room(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS location (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (place_id) REFERENCES place(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES category(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  name TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  current_location_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES location(id),
  FOREIGN KEY (current_location_id) REFERENCES location(id),
  FOREIGN KEY (category_id) REFERENCES category(id)
);

CREATE INDEX IF NOT EXISTS idx_floor_structure ON floor(structure_id);
CREATE INDEX IF NOT EXISTS idx_room_floor ON room(floor_id);
CREATE INDEX IF NOT EXISTS idx_place_room ON place(room_id);
CREATE INDEX IF NOT EXISTS idx_location_place ON location(place_id);
CREATE INDEX IF NOT EXISTS idx_item_location ON item(location_id);
CREATE INDEX IF NOT EXISTS idx_item_current_location ON item(current_location_id);
CREATE INDEX IF NOT EXISTS idx_item_category ON item(category_id);
CREATE INDEX IF NOT EXISTS idx_item_deleted ON item(is_deleted);
```

Примечания:

- `address TEXT` оставлен nullable, потому что пока неясно, обязателен ли адрес.
- `properties TEXT` — хранить JSON-строкой, а не объектом.
- `current_location_id` — исправленная опечатка.
- `parent_id INTEGER` — разрешает корневые категории.
- `is_deleted INTEGER` — SQLite не имеет отдельного boolean; 0/1 — стандартный вариант.
- `updated_at` нужно обновлять вручную в SQL или через триггер.

## 5. API

### 5.1 Текущие маршруты

`item/item-router.js`:

| Метод | Путь | Обработчик | Проблема |
|---|---|---|---|
| `GET` | `/items` | `getItems` | Нет фильтров/пагинации; `ids` обрабатывается неверно |
| `GET` | `/items/:id` | `getItem` | Нет 404; возвращает массив |
| `PATCH` | `/items/:id` | `updateItem` | Дублируется с удалением; всегда 400 |
| `PATCH` | `/items` | `createItem` | Должен быть `POST` |
| `PATCH` | `/items/:id` | `deleteItem` | Должен быть `DELETE`; перекрыт предыдущим маршрутом |

Из-за того, что `PATCH /:id` зарегистрирован дважды, второй обработчик (`deleteItem`)
недостижим: `@koa/router` выбирает первый подходящий маршрут.

### 5.2 Целевые маршруты

| Метод | Путь | Назначение | Успех |
|---|---|---|---|
| `GET` | `/items` | Список с фильтрами и пагинацией | `200` |
| `GET` | `/items/:id` | Один предмет | `200` / `404` |
| `POST` | `/items` | Создание | `201` |
| `PATCH` | `/items/:id` | Частичное обновление | `200` / `404` |
| `DELETE` | `/items/:id` | Мягкое удаление | `204` / `404` |

Опционально:

- `POST /items/:id/restore` — восстановление после мягкого удаления;
- `GET /items?includeDeleted=true` — явный показ удалённых (только для администратора).

Параметры списка:

- `ids=1&ids=2` или `ids=1,2` — нормализовать в массив чисел;
- `status=broken`;
- `categoryId=3`;
- `locationId=5`;
- `page=1` (по умолчанию 1);
- `limit=50` (по умолчанию 50, максимум, например, 200);
- `includeDeleted=false`.

### 5.3 Формат ответов

Успех:

```json
{
  "data": {}
}
```

Список:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 0
  }
}
```

Ошибка:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Переданы неверные данные",
    "details": []
  }
}
```

Коды:

- `400` — неверный JSON/параметры;
- `404` — предмет не найден;
- `409` — конфликт (например, дубликат);
- `422` — семантическая ошибка валидации;
- `500` — непредвиденная ошибка.

## 6. Ошибки

### P0 — блокеры запуска

#### 6.1 `index.js`

1. **Строка 3:** `import { ItemController } from './item/item-controller';`
   В `item-controller.js` есть только `export default class ItemController`.
   ESM попытается найти именованный экспорт и упадёт на этапе линковки:
   `The requested module does not provide an export named 'ItemController'`.

2. **Строка 4:** контроллер импортируется второй раз как default. Один из импортов лишний.

3. **Строки 3–4:** относительный путь без `.js`. В Node ESM расширение обязательно:
   `./item/item-controller.js`.

4. **Строка 12:** `itemRouter` не объявлен и не импортирован. Даже если исправить
   именованный импорт, будет `ReferenceError: itemRouter is not defined`.

5. **Нет обработчика ошибок.** Любая ошибка в async-контроллере уйдёт в стандартный
   обработчик Koa и вернёт 500 без нормального JSON-конверта.

6. **Нет подключения роутера и миграции при старте.** Роутер надо импортировать,
   а БД — инициализировать до `listen`.

Минимальный целевой вариант:

```js
import Koa from 'koa';
import BodyParser from 'koa-bodyparser';
import router from './item/item-router.js';

const app = new Koa();

app.use(BodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Server started: http://localhost:${port}`);
});
```

#### 6.2 `item/item-router.js`

1. **Строка 2:** `import ItemController from './item/item-controller.js';`
   Файл находится в `item/`, поэтому путь превращается в
   `item/item/item-controller.js`. Правильно: `./item-controller.js`.

2. **Строка 12:** создание через `router.patch('/')`. Должно быть `router.post('/')`.

3. **Строка 13:** удаление через `router.patch('/:id')`. Должно быть
   `router.delete('/:id')`.

4. **Строки 11 и 13:** два одинаковых маршрута `PATCH /:id`. Второй недостижим.

5. **Нет маршрута `POST` и `DELETE`**, хотя они описаны в `readme.md`.

6. **Нет middleware валидации** (ID, тело запроса, статус).

Целевой вариант:

```js
import Router from '@koa/router';
import ItemController from './item-controller.js';

const router = new Router({ prefix: '/items' });
const controller = new ItemController();

router.get('/', controller.getItems.bind(controller));
router.get('/:id', controller.getItem.bind(controller));
router.post('/', controller.createItem.bind(controller));
router.patch('/:id', controller.updateItem.bind(controller));
router.delete('/:id', controller.deleteItem.bind(controller));

export default router;
```

#### 6.3 `item/item-controller.js`

1. **Строка 1:** `import ItemService from './item.service';`
   Файла `item.service.js` нет, есть `item-service.js`; расширение `.js` обязательно.

2. **Строка 3:** `import { EItemsStatus } from '../enums';` — нужен `../enums.js`.

3. **Строка 4:** `import { message, status } from 'koa/lib/response';`
   В модуле ответа Koa нет таких именованных экспортов; импорт не нужен и, скорее всего,
   сам по себе приведёт к ошибке загрузки. Удалить.

4. **Строка 92:** `isCorrectStatus` используется, но не импортирован.
   Сейчас до него не доходит из-за короткого замыкания в условии, но после исправления
   `isNotEmpty` будет `ReferenceError`.

5. **Строка 65:** `const res = this.service.update();`
   Вызов без `id` и тела, без `await`. В сервисе идёт деструктуризация `undefined`,
   поэтому будет `TypeError`.

6. **Строка 72:** `this.#throwUncorrectedDataError(ctx);` вызывается безусловно,
   уже после установки `ctx.status = 200`. В итоге обновление всегда возвращает 400,
   даже если всё прошло успешно.

7. **Строки 88–96:** условие собрано через `||`:
   ```js
   if (
     isNotEmpty(name) ||
     isNotEmpty(properties) ||
     ...
   )
   ```
   Это проверка «хотя бы одно поле не пустое», а не «все поля валидны». Плюс
   `isNotEmpty` всегда `true` (см. `utils.js`), поэтому условие всегда истинно.

8. **Строка 97:** `return this.service.create(...)` стоит до установки
   `ctx.status = 201` и `ctx.body`. Строки 106–110 недостижимы. В результате создание
   не возвращает ни статус 201, ни тело.

9. **`createItem` не проверяет `status`** через `isCorrectStatus`; проверка присутствует
   в условии, но из-за `||` и всегда истинного `isNotEmpty` не работает.

10. **`deleteItem` не проверяет результат.** Если записи нет, всё равно вернётся 200.

11. **`getItem` не возвращает 404.** `getOne` возвращает массив, и контроллер отдаёт
    `200 { data: [] }`.

12. **`getItems` не поддерживает фильтры, сортировку и пагинацию**, описанные в `readme.md`.

13. **Нет проверки ID** на целое положительное число.

14. **Нет `try/catch`** и централизованной обработки ошибок.

Целевое создание:

```js
async createItem(ctx) {
  const dto = new ItemDto(ctx.request.body);
  const item = await this.service.create(dto.object);

  ctx.status = 201;
  ctx.body = { data: item };
}
```

`ItemDto` пока не существует; его нужно создать по аналогии с `StructureDto`/`FloorDto`.

#### 6.4 `item/item-service.js`

1. **Строки 1–2:** импорты без `.js`:
   `../db/sqlite` → `../db/sqlite.js`, `../utils` → `../utils.js`.

2. **Строка 5:** `this.link = new SqliteLinker();`
   Не передан путь к файлу БД и не вызван `connect()`. В итоге `this.link.db` остаётся
   `null`, и любой запрос падает.

3. **Строка 11:** `isEmpty` не импортирован. Плюс опечатка `ids.lenght` вместо
   `ids.length`.

4. **Строка 17:** `createPlaceholders(ids)` вызывает `ids.map(...)`.
   Если `ids` пришёл строкой (`?ids=1,2`), будет `TypeError: ids.map is not a function`.

5. **Строка 31:** `tgis.link.run(...)` — опечатка, `ReferenceError: tgis is not defined`.
   Мягкое удаление не работает.

6. **Строка 43:** параметр называется `current_location_id`, а строка 50 использует
   `curent_location_id`. Это свободная переменная, `ReferenceError`.

7. **Строки 64–87:** `insert into item values (...)` без списка колонок.
   В таблице 8 колонок:
   `id, is_deleted, name, properties, status, location_id, curent_location_id, category_id`,
   а передаётся 6 значений. SQLite вернёт ошибку
   `table item has 8 columns but 6 values were supplied`.

8. **`properties` — объект.** sqlite3 не умеет биндить произвольный объект как значение;
   его нужно преобразовать в JSON-строку через `JSON.stringify`.

9. **Нет фильтрации удалённых записей.** `getAll` и `getOne` возвращают `is_deleted = 1`.

10. **Нет транзакций.** Создание, обновление и удаление не атомарны.

11. **Нет проверки количества затронутых строк.** Обновление/удаление несуществующего
    ID неотличимо от успешного.

12. **`update` не проверяет пустой набор полей.** Если все поля пустые, получится
    SQL `set ` без выражений.

Целевое подключение:

```js
constructor() {
  this.link = new SqliteLinker(process.env.DB_PATH ?? './database.db');
}

async connect() {
  await this.link.connect();
}
```

Лучше сделать `SqliteLinker` singleton или внедрять его в сервис извне.

#### 6.5 `db/sqlite.js`

1. **Строки 1–3:** два импорта с одинаковым именем `sqlite`:
   ```js
   import sqlite from 'sqlite3';
   import sqlite from './sqlite.js';
   ```
   Это синтаксическая ошибка `Identifier 'sqlite' has already been declared`.
   Второй импорт — циклический импорт самого себя; он не нужен.

2. **Строки 29–98:** внутри `new Promise(function (resolve, reject) { ... })`
   используется обычная функция, поэтому `this` не указывает на экземпляр класса.
   Все методы `run`, `get`, `all`, `close` падают на `this.db`.

   Правильно — стрелочная функция для executor и обычная функция для callback sqlite3:

   ```js
   async run(sql, params = []) {
     return new Promise((resolve, reject) => {
       this.db.run(sql, params, function (err) {
         if (err) return reject(err);
         resolve({ lastId: this.lastID, changes: this.changes });
       });
     });
   }
   ```

   Внутри callback `this` — объект statement, поэтому `this.lastID` и `this.changes`
   работают.

3. **Строка 109:** `isEmpty` используется, но не импортирован.
   `createSetBlock` падает с `ReferenceError`.

4. **`connect()` не ждёт открытия БД.** `new sqlite.Database(...)` возвращает объект
   сразу, а ошибка только логируется. Нужно обернуть открытие в Promise и отклонять его
   при ошибке.

5. **`connect()` не включает `PRAGMA foreign_keys = ON`** для рабочего соединения.

6. **`connect()` не настраивает `busy_timeout`**, поэтому параллельные запросы могут
   падать с `SQLITE_BUSY`.

7. **`close()` вызывается до завершения открытия** в некоторых сценариях миграции.

Целевое подключение:

```js
async connect() {
  await new Promise((resolve, reject) => {
    this.db = new sqlite.Database(this.filename, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await this.run('PRAGMA foreign_keys = ON');
  await this.run('PRAGMA busy_timeout = 5000');

  return this.db;
}
```

8. **`createSetBlock` не имеет белого списка полей.** Сейчас ключи приходят из
   контроллера, но при рефакторинге это станет SQL-инъекцией. Нужно проверять допустимые
   имена колонок.

9. **`createSetBlock` не позволяет установить `NULL` или пустую строку**: пустые
   значения просто отбрасываются. Нужен явный механизм `null`/`undefined`.

#### 6.6 `db/migration.js`

1. **Строки 30–32:** `down()` вызывает `db.exec(sql)`, но `db` нигде не объявлен.
   Должен быть `await exec(sql)`.

2. **Строка 21:** `await linker.close()` в `finally`.
   Если `new Linker(...)` или `connect()` упали до присваивания, `linker` останется
   `undefined`, и `finally` бросит новую ошибку, замаскировав исходную.

3. **Строка 12:** жёстко зашит `./database.db`. Приложение создаёт `SqliteLinker()`
   без пути, поэтому миграции и приложение могут работать с разными БД.
   Нужен единый `DB_PATH`.

4. **Каждый `up()` открывает новое соединение.** Это медленно и сбрасывает
   `PRAGMA foreign_keys`, который действует только в пределах соединения.

5. **Нет транзакции.** Если миграция упадёт посередине, схема останется частично
   созданной.

6. **Нет таблицы `schema_migrations`.** Непонятно, какие миграции уже применены.

7. **`catch` теряет исходную ошибку.** Логируется `err`, но наружу уходит generic
   `Error('This migration is failed...')` без `cause`.

8. **Нет проверки, что `linker` существует, перед `close()`.**

#### 6.7 `db/migrations/23-09-2026-create-db.js`

1. **`createDB()` не вызывается и не экспортируется.** Простой запуск файла
   `node db/migrations/23-09-2026-create-db.js` только объявит функцию и завершится.
   Нужен экспорт и раннер.

2. **`item` создаётся до `location`.** Порядок должен быть:
   `structure → floor → room → place → location → category → item`.

3. **`category.parent_id INTEGER NOT NULL`** не позволяет корневые категории
   и конфликтует с `ON DELETE SET NULL`.

4. **`is_deleted BOOLEAN`** без `NOT NULL DEFAULT 0`.

5. **`properties JSONB`** — в SQLite это не отдельный тип; используйте `TEXT`.

6. **`curent_location_id`** — опечатка; должно быть `current_location_id`.

7. **`structure` без `address`**, хотя DTO ожидает адрес.

8. **Нет индексов, timestamps, уникальных ограничений и `CHECK` для статуса.**

9. **Внешние ключи `item` не имеют `ON DELETE`.** Удаление локации с предметами
   будет блокироваться.

10. **`PRAGMA foreign_keys = ON`** выполняется в отдельном `up()` и не действует
    на последующие соединения.

11. **Нет `down()`-миграции.** Откатить схему нельзя.

### P1 — логика и данные

#### 6.8 `utils.js` — сломанная валидация

```js
export function isNotEmpty(data) {
  return (
    typeof data !== undefined ||
    data !== null ||
    JSON.stringify(data) !== '{}' ||
    data !== ''
  );
}
```

Проблемы:

1. `typeof data !== undefined` всегда `true`: `typeof` возвращает строку
   (`'undefined'`, `'string'`, `'number'`), а сравнивается с значением `undefined`.
   Нужно `typeof data !== 'undefined'`.

2. Даже после исправления первого пункта `||` делает условие почти всегда истинным.
   Для «не пусто» нужна логика `&&` (или явная проверка каждого типа).

3. `isNotEmpty(null)` возвращает `true` из-за первого условия.
4. `isNotEmpty('')`, `isNotEmpty(0)`, `isNotEmpty(false)` тоже возвращают `true`.
5. `JSON.stringify` не помогает: для `undefined` он возвращает `undefined`,
   для `[]` — `'[]'`, для `{ a: 1 }` — `'{"a":1}'`.

`isEmpty`:

```js
export function isEmpty(data) {
  return (
    typeof data === undefined ||
    data === null ||
    JSON.stringify(data) === '{}' ||
    data === ''
  );
}
```

1. `typeof data === undefined` всегда `false`; нужно `typeof data === 'undefined'`.
2. `isEmpty` и `isNotEmpty` не являются взаимно обратными.
3. Пустой массив `[]` не считается пустым.
4. `isNumber(NaN)` возвращает `true`; лучше `Number.isFinite`.
5. `isString` не проверяет пустую строку и пробелы.

Из-за этого:

- `createItem` всегда входит в ветку создания;
- DTO пропускают невалидные данные;
- `createSetBlock` неверно фильтрует поля;
- `FloorDto`/`StructureDto` не выполняют свою работу.

#### 6.9 Мягкое удаление

- `getAll`/`getOne` не добавляют `where is_deleted = 0`.
- `softDelete` не проверяет, что запись существует.
- Нет `deleted_at`, нет восстановления.
- Нет политики: что делать с предметами при удалении локации/категории.
- `is_deleted` может быть `NULL` у старых записей.

#### 6.10 Ответы и коды HTTP

- `getOne` возвращает массив, а не объект.
- `getItem` не возвращает 404.
- `createItem` не возвращает 201 и тело.
- `deleteItem` возвращает 200 вместо 204.
- `updateItem` всегда возвращает 400 из-за безусловного вызова ошибки.
- Форматы `{ data }` и `{ status, message }` смешаны.
- Нет единого конверта ошибок.
- Нет `Content-Type`-проверки и ограничения размера тела.

#### 6.11 Валидация

- Нет проверки `name` (строка, не пустая, максимальная длина).
- Нет проверки `properties` (объект, не массив, допустимые ключи).
- Нет проверки `status` на допустимое значение.
- Нет проверки `location_id`, `current_location_id`, `category_id` на положительные целые.
- Нет проверки `id` в path.
- Нет проверки тела `PATCH` на пустоту.
- Нет проверки, что `category_id`/`location_id` существуют.
- Нет проверки прав доступа.

#### 6.12 JSON и SQL

- `properties` не сериализуется при записи и не парсится при чтении.
- `select *` отдаёт наружу `is_deleted` и внутренние поля.
- `insert into item values (...)` без списка колонок ломается при изменении схемы.
- `where id in (...)` собирается через `createPlaceholders`, но `ids` не нормализуются.
- `update ... set ${block}` требует белого списка колонок.
- Нет `LIMIT`/`OFFSET`.
- Нет транзакций и проверки `changes`.
- Нет `EXPLAIN QUERY PLAN`/индексов для фильтров.

#### 6.13 Обработка ошибок и безопасность

- Нет middleware `app.on('error')`/`try/catch`.
- Нет структурированного логирования.
- Нет CORS, если фронтенд будет на другом origin.
- Нет авторизации: любой может читать/менять/удалять предметы.
- Нет rate limit и ограничения размера JSON.
- Сообщения об ошибках на русском и английском вперемешку.
- Нет graceful shutdown: соединение с БД не закрывается по `SIGINT`/`SIGTERM`.
- `koa-bodyparser` не настроен (`jsonLimit`, `enableTypes`).

### P2 — схема, слои, архитектура

1. **Нет слоя репозитория.** Контроллер создаёт сервис, сервис создаёт `SqliteLinker`.
   Нет DI, нет единого соединения, сложно тестировать.
2. **DTO не используются.** `FloorDto` и `StructureDto` не подключены к контроллерам.
3. **`item/item-entity.js` пустой.** Доменной модели предмета нет.
4. **`db/dtos/floor.dto.js`:**
   - импортирован только `isNotEmpty`, но используются `isString` и `isNumber`;
   - импорт `../../utils` без `.js`;
   - `isNotEmpty` сломан, поэтому проверка всегда проходит;
   - `isNumber(NaN)` истинно.
5. **`db/dtos/structure.dto.js`:**
   - ожидает `address`, которого нет в таблице `structure`;
   - импорт без `.js`;
   - `isNotEmpty` сломан.
6. **Нет маппинга БД → API.** Строки SQLite отдаются как есть, включая `is_deleted`.
7. **Нет миграционного раннера** и таблицы версий.
8. **Нет тестов** (юнит, интеграционных, HTTP).
9. **Нет `start`/`dev` скрипта.**
10. **Нет `engines`**, хотя зависимости требуют Node >= 20.17.
11. **`sqlite3` — нативный модуль.** В StackBlitz/WebContainer он может не собраться
    или не загрузиться. Если проект должен работать в браузерном StackBlitz,
    рассмотрите `sql.js` (WASM) или `better-sqlite3` с проверкой среды.
12. **`koa-bodyparser@4.4.1`** старый; проверьте совместимость с Koa 3.
13. **Нет `schema_migrations`** и стратегии отката.
14. **Нет `updated_at`/`created_at`.**
15. **Нет уникальных ограничений** на бизнес-сущности.
16. **Нет `CHECK` для статуса.**
17. **Нет индексов по внешним ключам.**
18. **Смешение стилей имен файлов:** `item.service.js` в импорте против
    `item-service.js` в файловой системе; `floor.dto.js` против `item-service.js`.
19. **Много мёртвого кода:** неиспользуемые импорты (`isNotEmptyArray`, `isString`,
    `message`, `status`, `ItemController` в `index.js`), неиспользуемые DTO,
    пустой `item-entity.js`.
20. **Нет конфигурации окружения** (`PORT`, `DB_PATH`, `NODE_ENV`).

### P3 — документация, конфиги, качество

1. **`readme.md` — заготовка.**
   - пустые заголовки `Header`, `header 2`;
   - список-заглушка;
   - нет описания проекта, структуры, запуска, миграций, эндпоинтов и env;
   - нет примеров запросов/ответов.

2. **Опечатки в `readme.md`:**
   - метод `PUT` трижды назван `cut` (строки 30, 50, 58);
   - пример `GET /users?id=2` противоречит правилу «идентификатор — в path»;
   - пример `/item/{itemId}/upload` в единственном числе противоречит правилу
     «ресурсы во множественном числе»;
   - `sortKey = 1`/`sort = "ASC"` описаны противоречиво.

3. **`package.json`:**
   - нет `start`/`dev`;
   - `test` — заглушка `echo ... && exit 1`;
   - нет `engines`;
   - нет `description`/`version` (не критично).

4. **`.gitignore`:**
   - не игнорирует `database.db`, `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`;
   - не игнорирует логи, coverage, `.DS_Store`;
   - `.env` игнорируется, но нет `.env.example`.

5. **Комментарии:**
   - в `index.js` Koa назван HTTPS-сервером (это HTTP);
   - в `migration.js` комментарии с опечатками;
   - сообщения об ошибках на разных языках.

6. **Нет линтера/форматтера** (ESLint/Prettier) и единого стиля.

7. **Нет CI** и проверки импортов/тестов.

## 7. Правила для будущих правок

1. **ESM:** все относительные импорты — с `.js`; не импортировать модуль самого себя;
   не смешивать default/named экспорты без необходимости.
2. **Один контроллер — один default export.** В `index.js` импортировать только default.
3. **Одно соединение с БД** на приложение. `SqliteLinker` должен быть singleton
   или внедряться через DI. `connect()` — до старта сервера, `close()` — при остановке.
4. **`PRAGMA foreign_keys = ON`** — на каждом рабочем соединении, сразу после открытия.
5. **Все SQL — через обёртку.** Никаких `select *` наружу; перечисляйте колонки.
6. **Параметры — только через `?`.** Динамические имена колонок — только из белого списка.
7. **`properties`** — `JSON.stringify` при записи, `JSON.parse` при чтении.
8. **`insert`** — всегда со списком колонок.
9. **Транзакции** — для операций, меняющих несколько строк/таблиц.
10. **Мягкое удаление** — по умолчанию фильтровать `is_deleted = 0`; удалённые
    показывать только по явному `includeDeleted=true`.
11. **Валидация** — через DTO/схему: строки, числа, enum, обязательные поля, ID.
    Ошибки — 400/422 с деталями.
12. **HTTP-коды:** `POST` → 201, `GET` → 200/404, `PATCH` → 200/404,
    `DELETE` → 204/404.
13. **Единый формат ответа:** `{ data }` / `{ data, meta }` / `{ error }`.
14. **Ошибки** — через middleware, с кодом, сообщением и логированием.
15. **Имена:** `current_location_id` (не `curent`), `item-service.js` (kebab-case),
    маршруты во множественном числе.
16. **Не оставлять мёртвый код** и пустые файлы.
17. **Тесты** — хотя бы на утилиты, сервис и HTTP-сценарии.
18. **Конфиг** — через env, с `.env.example` и значениями по умолчанию.
19. **Не логировать пароли/секреты/полные тела запросов.**
20. **Документация** — обновлять `readme.md` при изменении API/схемы.

## 8. Чек-лист проверки

### Запуск

- [ ] `node --version` ≥ 20.17.
- [ ] `npm install` проходит без ошибок сборки `sqlite3`.
- [ ] `npm run db:migrate` создаёт `database.db` и все таблицы.
- [ ] `PRAGMA foreign_keys` на рабочем соединении возвращает `1`.
- [ ] `npm start` поднимает сервер на `PORT`.

### CRUD

- [ ] `POST /items` с валидным телом → `201`, `{ data: { id, ... } }`.
- [ ] `POST /items` без `name` → `400/422`.
- [ ] `POST /items` с неверным `status` → `400/422`.
- [ ] `POST /items` с `properties: {}` → сохраняется как JSON-строка.
- [ ] `GET /items` → `200`, массив, удалённые не входят.
- [ ] `GET /items?ids=1&ids=2` → только запрошенные.
- [ ] `GET /items?ids=1,2` → то же самое.
- [ ] `GET /items/:id` → `200`, объект.
- [ ] `GET /items/999999` → `404`.
- [ ] `PATCH /items/:id` с одним полем → `200`, поле изменилось.
- [ ] `PATCH /items/:id` с пустым телом → `400`.
- [ ] `PATCH /items/999999` → `404`.
- [ ] `DELETE /items/:id` → `204`.
- [ ] После `DELETE` предмет не виден в `GET /items`.
- [ ] `GET /items?includeDeleted=true` показывает удалённый.
- [ ] Повторный `DELETE` → `404` (или идемпотентный `204`, если так решено).

### Данные

- [ ] `properties` читается как объект, а не как строка.
- [ ] `is_deleted` всегда 0/1, не `NULL`.
- [ ] `current_location_id` сохраняется и читается.
- [ ] Удаление структуры с предметами не ломает БД (политика выбрана).
- [ ] Нет orphan-записей после удаления родителей.
- [ ] `EXPLAIN QUERY PLAN` использует индексы для фильтров.

### Качество

- [ ] `npm test` проходит.
- [ ] Нет необработанных `unhandledRejection`.
- [ ] Сервер корректно закрывает БД по `SIGINT`.
- [ ] Ошибки логируются с контекстом.
- [ ] `readme.md` содержит актуальные команды и примеры.

## 9. Приоритетный план исправлений

1. **Вернуть запуск.**
   - Исправить импорты в `index.js`, `item-router.js`, `item-controller.js`,
     `item-service.js`.
   - Убрать дублирующийся импорт и self-import в `db/sqlite.js`.
   - Исправить `itemRouter` → импорт роутера.

2. **Починить SQLite-обёртку.**
   - Заменить `function` на стрелки в executor.
   - Реализовать корректный `connect()` с Promise.
   - Добавить `PRAGMA foreign_keys = ON`, `busy_timeout`.
   - Импортировать `isEmpty` или убрать его.
   - Добавить `transaction()`.

3. **Починить миграции.**
   - Экспортировать/вызвать `createDB()`.
   - Исправить `down()`.
   - Создавать таблицы в правильном порядке.
   - Исправить `parent_id`, `is_deleted`, `properties`, `current_location_id`,
     `address`.
   - Добавить раннер и `schema_migrations`.

4. **Починить сервис.**
   - Подключить `SqliteLinker` с `DB_PATH`.
   - Исправить `tgis`.
   - Убрать `current_location_id`/`curent_location_id`-рассинхрон.
   - Сделать `insert` со списком колонок.
   - Добавить `JSON.stringify/parse`.
   - Добавить фильтр `is_deleted`.
   - Проверять `changes`.

5. **Починить контроллер и роутер.**
   - `POST`/`DELETE` вместо `PATCH`.
   - Убрать дублирующийся маршрут.
   - Добавить `await`, 201, 404, 204.
   - Убрать безусловный 400.
   - Подключить DTO/валидацию.

6. **Починить утилиты.**
   - Переписать `isEmpty`/`isNotEmpty`.
   - Добавить `isPositiveInt`, `isPlainObject`, `isValidStatus`.
   - Покрыть тестами.

7. **Добавить инфраструктуру.**
   - `start`/`dev`/`db:migrate`/`test` скрипты.
   - `engines`, `.env.example`.
   - Error middleware, graceful shutdown.
   - `.gitignore` для БД.
   - Обновить `readme.md`.

8. **Тесты и проверка.**
   - Юнит-тесты утилит и DTO.
   - Интеграционные тесты сервиса на временной БД.
   - HTTP-тесты CRUD.
   - Проверить сценарии из чек-листа.

## 10. Открытые вопросы

Эти вопросы не являются ошибками, но от них зависит схема и API:

1. **`location_id` vs `current_location_id`.** Это «место хранения» и «текущее
   местоположение»? Может ли текущее местоположение быть `NULL`? Оба поля сейчас
   `NOT NULL`.
2. **Статусы `on_place`, `broken`, `unlocked`.** `unlocked` — это точно нужное
   состояние? Нет ли `locked`? Какие переходы разрешены?
3. **Корневые категории.** Должны ли они существовать? Если да, `parent_id` должен
   быть nullable.
4. **`structure.address`.** Адрес обязателен? Если да, нужен `NOT NULL`; если нет —
   убрать из DTO.
5. **`properties`.** Это свободный JSON или схема с известными ключами? Нужны ли
   индексы/поиск по JSON?
6. **Мягкое удаление.** Что происходит с предметами при удалении локации/категории?
   Каскад, запрет или архивирование?
7. **Авторизация.** Кто может создавать/удалять? Нужны ли роли?
8. **Пагинация.** Какие значения по умолчанию и максимум `limit`?
9. **Путь к БД.** Всегда `./database.db` или зависит от окружения?
10. **Идемпотентность `DELETE`.** Повторное удаление — `404` или `204`?

## 11. Приложение: битые импорты

| Файл | Импорт | Проблема |
|---|---|---|
| `index.js:3` | `{ ItemController } from './item/item-controller'` | Нет named-экспорта; нет `.js` |
| `index.js:4` | `ItemController from './item/item-controller'` | Нет `.js`; дубль |
| `index.js:12` | `itemRouter` | Переменная не импортирована |
| `item/item-router.js:2` | `./item/item-controller.js` | Неверный путь из папки `item/` |
| `item/item-controller.js:1` | `./item.service` | Файл называется `item-service.js`; нет `.js` |
| `item/item-controller.js:3` | `../enums` | Нет `.js` |
| `item/item-controller.js:4` | `koa/lib/response` | Нет таких named-экспортов; не нужен |
| `item/item-service.js:1` | `../db/sqlite` | Нет `.js` |
| `item/item-service.js:2` | `../utils` | Нет `.js` |
| `db/dtos/floor.dto.js:1` | `../../utils` | Нет `.js` |
| `db/dtos/structure.dto.js:1` | `../../utils.js` | Расширение есть, но `isNotEmpty` сломан |
| `db/sqlite.js:1-3` | `sqlite` дважды, второй — self-import | `SyntaxError` |
| `db/migration.js:1` | `./sqlite.js` | Формально верно, но `sqlite.js` не загружается |

## 12. Итог на 2026-10-29

Проект находился в состоянии раннего черновика. Основная ценность — идея доменной
модели и структура слоёв, но реализация была нерабочей. Начинать нужно было не с
косметики, а с четырёх вещей:

1. ESM-импорты и точка входа.
2. Рабочая обёртка SQLite с корректным `connect()`.
3. Запускаемая миграция с правильным порядком таблиц.
4. Приведение контроллера/сервиса/роутов к одному контракту API.

Эти пункты исправлены; см. раздел 13.

## 13. Что исправлено 2026-10-31

### Проверка

- `npm test` — **110 тестов: 109 pass, 1 todo, 0 fail**.
- `npm run db:migrate` — миграция применяется, создаётся `database.db`.
- `npm run db:seed` — создаёт демо-иерархию; повторный запуск не создаёт дубликатов.
- Smoke-тест через реальный сервер:
  - `POST /items` → `201`;
  - `GET /items/:id` → `200`;
  - `PATCH /items/:id` → `200`;
  - `GET /items` → `200` с `meta`;
  - `DELETE /items/:id` → `204`;
  - повторный `GET /items/:id` → `404`;
  - `GET /items?includeDeleted=true` → удалённый предмет виден.

### Код

- Исправлены все относительные ESM-импорты (`.js`), устранён self-import в `db/sqlite.js`.
- `index.js` переписан: подключение БД, создание приложения, запуск, graceful shutdown.
- Добавлен `app.js`: error middleware, body parser, роутер, 404, логирование 500.
- Добавлен `errors.js`: `ApiError`, `ValidationError`, `NotFoundError`.
- `db/sqlite.js`: корректный `connect()`, `run/get/all/close`, `transaction()`,
  `PRAGMA foreign_keys = ON`, `busy_timeout`, безопасный `createSetBlock`.
- `db/migration.js`: `up/down` работают через переданный `linker`; убраны утечки соединений.
- Добавлен `db/migrations/run.js` и таблица `schema_migrations`.
- Схема БД исправлена: порядок таблиц, `current_location_id`, `is_deleted` с default/check,
  `properties TEXT`, nullable `category.parent_id`, `structure.address`, timestamps, индексы.
- `item/item-service.js`: корректные `select`, `insert` со списком колонок,
  `JSON.stringify/parse`, фильтр `is_deleted`, транзакционный слой, проверка `changes`.
- `item/item-entity.js`: валидация create/patch.
- `item/item-controller.js`: `POST`/`PATCH`/`DELETE`, 201/204/404, пагинация,
  фильтры, нормализация `ids`, единый формат ответов.
- `item/item-router.js`: правильные HTTP-методы, внедрение контроллера.
- `utils.js`: `isEmpty`/`isNotEmpty` переписаны; добавлены `isPositiveInt`, `isPlainObject`;
  `isNumber` отвергает `NaN`/`Infinity`.
- DTO этажа/структуры исправлены и используют общие проверки.
- `package.json`: добавлены `start`, `dev`, `db:migrate`, `test`, `engines`.
- Добавлены `.env.example`, `.gitignore` для БД, `readme.md` с актуальными командами.
- Добавлены тесты: `test/items.crud.test.js`, `test/items.validation.test.js`,
  `test/items.query.test.js`, `test/items.errors.test.js`, `test/helpers/*`,
  `test/fixtures/items.js`, `test/utils.test.js`, `test/seed.test.js`.
  Каждый тест работает с изолированной in-memory SQLite и своим HTTP-сервером.
- Добавлен `db/seed.js` и скрипт `npm run db:seed`: идемпотентно создаёт
  демо-иерархию `structure → floor → room → place → location` и категорию,
  чтобы предметы можно было создавать сразу после миграции.

### Что осталось за рамками исправлений

- Авторизация/роли, CORS, rate limit.
- CRUD-эндпоинты для `structure`, `floor`, `room`, `place`, `location`, `category`.
- Строгая схема `properties` (сейчас проверяется только то, что это JSON-объект).
- Уникальные ограничения и `updated_at`-триггер.
- CI, линтер, форматтер.
- Стратегия отката миграций (`down` для конкретных миграций).
- Проверка поведения `sqlite3` на StackBlitz/WebContainer (нативный модуль).
- Более подробное логирование и метрики.
- Нарушение FK (несуществующий `location_id`/`category_id`) возвращает 500
  вместо 400; сценарий отмечен в тестах как `todo`.
- Ответ `405` содержит тело `NOT_FOUND` из-за порядка middleware; статус
  и заголовок `Allow` при этом корректны.
