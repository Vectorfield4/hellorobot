# Articles

Текстовый архив статей: один файл на статью, `<slug>.ru.md`. Сайт одноязычный
(`astro.config.ts`, `i18n.locales: ["ru"]`), поэтому английского зеркала нет и не
пишется: файл `.en.md` не получает ни маршрута, ни читателя, а только удваивает
текст при каждом последующем чтении.
Сайт эти файлы не читает — страницы собираются из WordPress через WPGraphQL
(`src/shared/data/posts.ts`). Здесь лежит текст, `source_url` и связка с постом WP.

- Frontmatter: `title`, `slug`, `date`, `tags`, `source_url`, `status`
  (`draft` | `published`), `wp_id`, `wp_url`.
- `status: draft` — текст готов, но пост в WordPress ещё не создан.
- `status: published` — пост опубликован; `wp_id` и `wp_url` заполнены.

## Кто что читает

- `published-check` (шаг 2 новостной цепочки) сверяет кандидатов с этой папкой по
  `source_url`, slug и заголовку — это постоянный след «источник уже собран».
- Редактор и агент читают текст при перевыпуске, ссылке на источник и вычитке.

## Дневной лог собранного

Чтобы не полагаться только на фронтматтер, каждая публикация пишет запись в
`docs/collected/<YYYY-MM-DD>.yaml` (`scripts/collected.mjs`): slug, `source_url`,
`wp_id`, время. У файла есть `ttl_days` и `expires` — запись живёт неделю и
удаляется `prune`, чтобы папка не превращалась в свалку:

```bash
node scripts/collected.mjs add --slug <slug> --url <source-url> --wp-id <id>
node scripts/collected.mjs export --out docs/research/collected.json
node scripts/collected.mjs prune
```

`export` даёт JSON в форме, которую принимает `published-check --wp`, так что
дедуп работает и без markdown, если пост уже опубликован.
