/** Planet colours as on the in-game map: Dark Side red, Mixed yellow, Light Side blue. */
export const PLANET_STYLE: Record<
  string,
  { short: string; accent: string; border: string; text: string; bar: string; ring: string }
> = {
  "Dark Side": {
    short: "DS",
    accent: "border-t-red-500",
    border: "border-red-500",
    text: "text-red-300",
    bar: "bg-red-500",
    ring: "ring-red-500/70",
  },
  Mixed: {
    short: "Mixed",
    accent: "border-t-yellow-400",
    border: "border-yellow-400",
    text: "text-yellow-200",
    bar: "bg-yellow-400",
    ring: "ring-yellow-400/70",
  },
  "Light Side": {
    short: "LS",
    accent: "border-t-sky-400",
    border: "border-sky-400",
    text: "text-sky-300",
    bar: "bg-sky-400",
    ring: "ring-sky-400/70",
  },
};
