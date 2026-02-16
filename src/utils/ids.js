const fallbackId = () => {
  let id = '';
  for (let index = 0; index < 4; index += 1) {
    id += Math.random().toString(36).slice(2, 10);
  }
  return id;
};

export const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return fallbackId();
};
