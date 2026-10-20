import * as stylex from "@stylexjs/stylex";

export const tokens = stylex.defineVars({
  colorBg: "#ffffff",
  colorFg: "#111111",
  colorAccent: "#0066cc",
  spaceSm: "0.5rem",
  spaceMd: "1rem",
  spaceLg: "2rem",
  radiusMd: "0.5rem",
  fontBody: "system-ui, sans-serif",
});

export const darkTheme = stylex.createTheme(tokens, {
  colorBg: "#111111",
  colorFg: "#ffffff",
  colorAccent: "#66aaff",
});
