export const SELECTION_COLOR = '#2196F3';
export const ERROR_COLOR = '#ef4444';
export const ERROR_BG = '#fee2e2';
export const ERROR_TEXT = '#991b1b';
export const WARNING_COLOR = '#F59E0B';
export const OBJECT_COLORS = [
  '#FFD700',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];
export const DEFAULT_STICKY_COLOR = '#FFD700';
export const DEFAULT_RECTANGLE_COLOR = '#4ECDC4';
export const DEFAULT_CIRCLE_COLOR = '#FF6B6B';
export const DEFAULT_LINE_COLOR = '#45B7D1';
export const DEFAULT_TEXT_COLOR = '#111827';
export const DEFAULT_FRAME_COLOR = 'rgba(148, 163, 184, 0.15)';

const hashUid = (uid) => {
  let hash = 5381;
  for (let index = 0; index < uid.length; index += 1) {
    hash = (hash * 33) ^ uid.charCodeAt(index);
  }
  return Math.abs(hash) % 360;
};

const isReservedHue = (hue) => (hue >= 195 && hue <= 225) || hue < 15 || hue > 345;

export const cursorColorFromUid = (uid) => {
  let hue = hashUid(uid);

  while (isReservedHue(hue)) {
    hue = (hue + 30) % 360;
  }

  return `hsl(${hue}, 70%, 50%)`;
};
