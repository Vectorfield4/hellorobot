import * as stylex from "@stylexjs/stylex";
import { tokens } from "../design/tokens.stylex";

interface Props {
  title: string;
  date: string;
  slug: string;
  excerpt?: string;
  tags?: string[];
}

const styles = stylex.create({
  card: {
    padding: tokens.spaceMd,
    marginBottom: tokens.spaceMd,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.colorBg,
    color: tokens.colorFg,
    border: "1px solid #ddd",
  },
  title: { fontSize: "1.25rem", margin: 0 },
  meta: { fontSize: "0.85rem", opacity: 0.7, marginTop: tokens.spaceSm },
  tags: { display: "flex", gap: tokens.spaceSm, flexWrap: "wrap", marginTop: tokens.spaceSm },
  tag: {
    fontSize: "0.75rem",
    padding: "0.15rem 0.5rem",
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.colorAccent,
    color: "#fff",
  },
  excerpt: { marginTop: tokens.spaceSm },
});

export default function ArticleCard({ title, date, slug, excerpt, tags = [] }: Props) {
  return (
    <article {...stylex.props(styles.card)}>
      <h2 {...stylex.props(styles.title)}>
        <a href={`/news/${slug}`}>{title}</a>
      </h2>
      <div {...stylex.props(styles.meta)}>{date}</div>
      {tags.length > 0 && (
        <div {...stylex.props(styles.tags)}>
          {tags.map((t) => (
            <span key={t} {...stylex.props(styles.tag)}>
              {t}
            </span>
          ))}
        </div>
      )}
      {excerpt && <p {...stylex.props(styles.excerpt)}>{excerpt}</p>}
    </article>
  );
}
