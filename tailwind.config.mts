import type { Config } from "tailwindcss";
import tokens from "./_brand/tokens.json";

const { color, radius, tapTargetMin, font } = tokens;

const px = (value: number) => `${value}px`;

// _brand/tokens.json is the source of truth. `colors` replaces Tailwind's
// default palette on purpose, so only Imarah Teal colours can be used.
const config: Config = {
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      primary: color.primary,
      "primary-dark": color.primaryDark,
      tint: color.tint,
      background: color.background,
      surface: color.surface,
      border: color.border,
      rule: color.rule,
      ink: color.ink,
      muted: color.muted,
      gold: color.gold,
      "gold-tint": color.goldTint,
      "warn-bg": color.warnBg,
      "warn-ink": color.warnInk,
      track: color.track,
    },
    extend: {
      borderRadius: {
        chip: px(radius.chip),
        card: px(radius.card),
        panel: px(radius.panel),
        hero: px(radius.hero),
        pill: px(radius.pill),
      },
      spacing: {
        tap: px(tapTargetMin),
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", font.family, "system-ui", "sans-serif"],
      },
    },
  },
};

export default config;
