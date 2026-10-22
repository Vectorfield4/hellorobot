import gsap from "gsap";

/**
 * One shared motion language for card reveals: a short, calm drop-in from
 * above. Keep these values in sync with the pre-hydration state in BaseLayout
 * (`translateY(-10px)`).
 */
const REVEAL_DISTANCE = 10;
const REVEAL_DURATION = 0.36;
const REVEAL_STAGGER = 0.05;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Reveals the given cards. When reduced motion is requested the cards are
 * simply made visible without a tween.
 */
export function revealCards(elements: Element[]): void {
  if (elements.length === 0) return;

  if (prefersReducedMotion()) {
    gsap.set(elements, { opacity: 1, y: 0, clearProps: "opacity,transform" });
    return;
  }

  gsap.fromTo(
    elements,
    { opacity: 0, y: -REVEAL_DISTANCE },
    {
      opacity: 1,
      y: 0,
      duration: REVEAL_DURATION,
      ease: "power2.out",
      stagger: REVEAL_STAGGER,
      overwrite: "auto",
      clearProps: "opacity,transform",
    },
  );
}
