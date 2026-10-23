import * as stylex from "@stylexjs/stylex";
import { tokens } from "@/shared/design/tokens.stylex";

interface Props {
  inStock: boolean;
  onBackorder?: boolean;
}

const styles = stylex.create({
  badge: {
    display: "inline-block",
    fontSize: "0.8rem",
    padding: "0.2rem 0.55rem",
    borderRadius: tokens.radiusMd,
  },
  inStock: { backgroundColor: "#e6f4ea", color: "#1a6b32" },
  onOrder: { backgroundColor: "#f2f5f8", color: "#46505a" },
});

export default function StockBadge({ inStock, onBackorder = false }: Props) {
  // Товара на складе нет, но он заказывается у поставщика: для покупателя это
  // одно состояние — «Под заказ», поэтому backlog отдельного вида не получает.
  const label = inStock ? "В наличии" : "Под заказ";
  const title = !inStock && onBackorder ? "Поставка под заказ у поставщика" : undefined;

  return (
    <span {...stylex.props(styles.badge, inStock ? styles.inStock : styles.onOrder)} title={title}>
      {label}
    </span>
  );
}
