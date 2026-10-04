// Choose contrasting text for any school color, including light pastels.
export function contrastText(hex: string): string {
  const rgb = hex.replace("#", "").match(/.{2}/g);
  if (!rgb || rgb.length !== 3) return "#ffffff";
  const [r, g, b] = rgb.map((v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}

export const themePresets = [
  {
    id: "blue",
    th: "ฟ้าโปร่ง",
    en: "Clear blue",
    primary_color: "#4264ad",
    secondary_color: "#f9dfeb",
    background_color: "#f4f6fc",
    background_color_dark: "#111522",
  },
  {
    id: "mint",
    th: "มิ้นต์",
    en: "Mint",
    primary_color: "#237c6b",
    secondary_color: "#d9efe7",
    background_color: "#f1f7f5",
    background_color_dark: "#10201d",
  },
  {
    id: "graphite",
    th: "กราไฟต์",
    en: "Graphite",
    primary_color: "#505b72",
    secondary_color: "#e5e7ee",
    background_color: "#f5f5f7",
    background_color_dark: "#17181c",
  },
] as const;
export type Palette = {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  background_color_dark: string;
};
export function palettePreset(palette: Palette) {
  return themePresets.find((preset) =>
    (
      [
        "primary_color",
        "secondary_color",
        "background_color",
        "background_color_dark",
      ] as const
    ).every((key) => preset[key].toLowerCase() === palette[key].toLowerCase()),
  );
}
