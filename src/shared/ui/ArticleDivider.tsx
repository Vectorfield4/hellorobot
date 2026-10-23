import gsap from "gsap";
import { useEffect, useRef } from "react";
import { tokens } from "../design/tokens.stylex";

export interface ArticleStat {
  label: string;
  value: string | number;
}

interface Props {
  stats?: ArticleStat[];
  label?: string;
  animate?: boolean;
}

export default function ArticleDivider({ stats = [], label, animate = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animate) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 48rem)").matches;
    const distance = isMobile ? 44 : 76;

    if (reducedMotion) {
      gsap.set(el, { opacity: 1, x: 0, scale: 1, clearProps: "opacity,transform" });
    } else {
      gsap.fromTo(
        el,
        { opacity: 0, x: distance, scale: 0.96 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 1.05,
          delay: 0.08,
          ease: "power3.out",
          overwrite: "auto",
          clearProps: "opacity,transform",
        },
      );
    }
    el.removeAttribute("data-divider-pending");
  }, [animate]);

  return (
    <div
      ref={ref}
      data-divider
      data-divider-pending
      className="article-divider"
      style={{
        margin: `${tokens.spaceMd} 0`,
        opacity: 1,
      }}
    >
      {stats.length > 0 && (
        <div
          className="article-divider__stats"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: tokens.spaceSm,
            justifyContent: "center",
            marginBottom: "0.5rem",
            fontSize: "0.8rem",
            opacity: 0.75,
          }}
        >
          {stats.map((s) => (
            <span key={s.label} className="article-divider__stat">
              <strong>{s.value}</strong> {s.label}
            </span>
          ))}
        </div>
      )}
      {label && (
        <div
          className="article-divider__label"
          style={{ textAlign: "center", opacity: 0.6, marginBottom: "0.5rem" }}
        >
          {label}
        </div>
      )}
      <hr
        className="article-divider__rule"
        style={{ border: "none", borderTop: "1px solid #ddd", margin: 0 }}
      />
    </div>
  );
}
