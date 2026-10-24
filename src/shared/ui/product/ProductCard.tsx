import * as stylex from "@stylexjs/stylex";
import { type Product, productPath } from "@/shared/data/product";
import { tokens } from "@/shared/design/tokens.stylex";

interface Props {
  product: Product;
  /** Плотный вариант для блоков внутри статьи. */
  compact?: boolean;
}

const styles = stylex.create({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusMd,
    border: "1px solid #ddd",
    backgroundColor: tokens.colorBg,
    color: tokens.colorFg,
  },
  cover: {
    width: "100%",
    aspectRatio: "16 / 9",
    objectFit: "cover",
    borderRadius: tokens.radiusMd,
    backgroundColor: "#f2f5f8",
  },
  coverPlaceholder: {
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: tokens.radiusMd,
    backgroundColor: "#f2f5f8",
  },
  title: {
    margin: 0,
    fontSize: "1.1rem",
    lineHeight: 1.25,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
  },
  excerpt: {
    margin: 0,
    fontSize: "0.9rem",
    opacity: 0.8,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
  },
});

export default function ProductCard({ product, compact = false }: Props) {
  const href = productPath(product.slug);
  return (
    <article {...stylex.props(styles.card)} className="product-card">
      <a href={href} aria-label={product.name}>
        {product.cover ? (
          <img
            {...stylex.props(styles.cover)}
            src={product.cover.thumbnail}
            alt={product.cover.alt}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div {...stylex.props(styles.coverPlaceholder)} aria-hidden="true" />
        )}
      </a>
      <h3 {...stylex.props(styles.title)}>
        <a href={href} style={{ textDecoration: "none", color: "inherit" }}>
          {product.name}
        </a>
      </h3>
      {!compact && product.excerpt && <p {...stylex.props(styles.excerpt)}>{product.excerpt}</p>}
    </article>
  );
}
