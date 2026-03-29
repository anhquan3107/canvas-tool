export const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => value + value)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);

  return `rgba(${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(
    expanded.slice(2, 4),
    16,
  )}, ${Number.parseInt(expanded.slice(4, 6), 16)}, ${alpha})`;
};

export const hexToPixiColor = (hex: string) =>
  Number.parseInt(hex.replace("#", ""), 16);
