export const SELECTION_COLOR = '#2196F3';
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

const hashUid = (uid) => {
  let hash = 0;
  for (let index = 0; index < uid.length; index += 1) {
    hash = (hash * 31 + uid.charCodeAt(index)) % 360;
  }
  return hash;
};

const isReservedHue = (hue) => (hue >= 195 && hue <= 225) || hue < 15 || hue > 345;

export const cursorColorFromUid = (uid) => {
  let hue = hashUid(uid);

  while (isReservedHue(hue)) {
    hue = (hue + 30) % 360;
  }

  return `hsl(${hue}, 70%, 50%)`;
};
