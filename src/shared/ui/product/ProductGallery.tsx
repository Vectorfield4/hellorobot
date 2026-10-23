import * as stylex from "@stylexjs/stylex";
import type { ProductImage } from "@/shared/data/product";
import { tokens } from "@/shared/design/tokens.stylex";

interface Props {
  images: ProductImage[];
  /** Подпись, если у снимка нет своего alt. */
  fallbackAlt: string;
}

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: tokens.spaceSm, margin: 0 },
  strip: {
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    borderRadius: tokens.radiusMd,
    backgroundColor: "#f2f5f8",
  },
  slide: {
    flexShrink: 0,
    width: "100%",
    margin: 0,
    scrollSnapAlign: "start",
  },
  main: {
    display: "block",
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "contain",
  },
  thumbs: {
    display: "flex",
    gap: tokens.spaceSm,
    overflowX: "auto",
  },
  thumbLink: {
    flexShrink: 0,
    display: "block",
    borderRadius: tokens.radiusMd,
    overflow: "hidden",
    border: "1px solid #ddd",
  },
  thumb: {
    display: "block",
    width: "4.5rem",
    height: "4.5rem",
    objectFit: "cover",
  },
  placeholder: {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: tokens.radiusMd,
    backgroundColor: "#f2f5f8",
  },
});

/**
 * Галерея без обязательного JS: снимки лежат в горизонтальной ленте со
 * scroll-snap, миниатюры — якоря внутри неё. Браузер сам доводит нужный слайд
 * до края, а без CSS остаётся обычный список картинок.
 */
export default function ProductGallery({ images, fallbackAlt }: Props) {
  if (!images.length) {
    return <div {...stylex.props(styles.placeholder)} aria-hidden="true" />;
  }

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.strip)}>
        {images.map((image, index) => (
          <figure key={image.src} id={`product-image-${index + 1}`} {...stylex.props(styles.slide)}>
            <img
              {...stylex.props(styles.main)}
              src={image.src}
              alt={image.alt || fallbackAlt}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <div {...stylex.props(styles.thumbs)}>
          {images.map((image, index) => (
            <a
              key={image.thumbnail}
              href={`#product-image-${index + 1}`}
              {...stylex.props(styles.thumbLink)}
            >
              <img
                {...stylex.props(styles.thumb)}
                src={image.thumbnail}
                alt={image.alt || fallbackAlt}
                loading="lazy"
                decoding="async"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
