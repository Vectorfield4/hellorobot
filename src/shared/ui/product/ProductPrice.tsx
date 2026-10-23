import * as stylex from "@stylexjs/stylex";
import { tokens } from "@/shared/design/tokens.stylex";

interface Props {
  /** Текущая цена, уже отформатированная под магазин. */
  priceLabel: string;
  /** Цена до скидки; пустая строка, если скидки нет. */
  regularPriceLabel?: string;
  onSale?: boolean;
}

const styles = stylex.create({
  root: {
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: tokens.spaceSm,
    margin: 0,
  },
  current: { fontSize: "1.5rem", fontWeight: 700 },
  oldWrap: { display: "inline-flex", alignItems: "baseline", gap: "0.25rem" },
  old: { fontSize: "1rem", opacity: 0.6 },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    clipPath: "inset(50%)",
  },
  badge: {
    fontSize: "0.75rem",
    padding: "0.1rem 0.4rem",
    borderRadius: tokens.radiusMd,
    backgroundColor: "#fdecec",
    color: "#a12626",
  },
});

export default function ProductPrice({
  priceLabel,
  regularPriceLabel = "",
  onSale = false,
}: Props) {
  const hasDiscount = Boolean(regularPriceLabel);

  return (
    <p {...stylex.props(styles.root)}>
      <span {...stylex.props(styles.current)}>{priceLabel}</span>
      {hasDiscount && (
        <span {...stylex.props(styles.oldWrap)}>
          <span {...stylex.props(styles.srOnly)}>Цена без скидки: </span>
          <s {...stylex.props(styles.old)}>{regularPriceLabel}</s>
        </span>
      )}
      {hasDiscount && onSale && <span {...stylex.props(styles.badge)}>Скидка</span>}
    </p>
  );
}
