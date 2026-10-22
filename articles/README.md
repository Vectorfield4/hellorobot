# Articles

Черновики и опубликованные статьи, спарсенные агентом, до загрузки в WordPress через MCP.

- Формат: `articles/<slug>.ru.md` (и `.en.md` для английской версии).
- Frontmatter: `title`, `slug`, `date`, `tags`, `source_url`, `status` (`draft` | `published`), `wp_id` (после публикации в WP).
- `status: draft` — статья спарсена, но ещё не загружена в WordPress.
- `status: published` — статья опубликована в WordPress; `wp_id` и `wp_url` заполнены.

Локальные фикстуры (`src/shared/mocks/fixtures/posts.ts`) и SSG-страницы используют только `published`-статьи; `draft`-статьи служат очередью для MCP-загрузки.