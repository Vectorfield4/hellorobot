# Articles

Текстовый архив статей: `<slug>.ru.md` и, когда есть перевод, `<slug>.en.md`.
Сайт эти файлы не читает — страницы собираются из WordPress через WPGraphQL
(`src/shared/data/posts.ts`). Здесь лежит текст, `source_url` и связка с постом WP.

- Frontmatter: `title`, `slug`, `date`, `tags`, `source_url`, `status`
  (`draft` | `published`), `wp_id`, `wp_url`.
- `status: draft` — текст готов, но пост в WordPress ещё не создан.
- `status: published` — пост опубликован; `wp_id` и `wp_url` заполнены.
- EN-версия — зеркало для чтения; сайт одноязычный (`astro.config.ts`, `locales: ["ru"]`),
  отдельного маршрута у неё нет.

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
