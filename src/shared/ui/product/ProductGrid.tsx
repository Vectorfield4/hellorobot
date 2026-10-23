import * as stylex from "@stylexjs/stylex";
import type { Product } from "@/shared/data/product";
import { tokens } from "@/shared/design/tokens.stylex";
import ProductCard from "@/shared/ui/product/ProductCard";

interface Props {
  products: Product[];
  /** Плотные карточки для узких блоков. */
  compact?: boolean;
}

const styles = stylex.create({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
    alignItems: "stretch",
    gap: tokens.spaceMd,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
});

export default function ProductGrid({ products, compact = false }: Props) {
  if (!products.length) return null;

  return (
    <div {...stylex.props(styles.grid)}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} compact={compact} />
      ))}
    </div>
  );
}
