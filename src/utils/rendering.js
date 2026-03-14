export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha ?? 1})`;
  // Expand 4-char shorthand (#RGB → #RRGGBB)
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(0,0,0,${alpha ?? 1})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
