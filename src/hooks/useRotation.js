import { useCallback, useRef } from 'react';

const toDegrees = (radians) => (radians * 180) / Math.PI;

export const normalizeAngle = (angle) => {
  let next = angle % 360;
  if (next < 0) {
    next += 360;
  }
  return next;
};

export const useRotation = () => {
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const centerRef = useRef({ x: 0, y: 0 });

  const startRotation = useCallback((center, pointer, currentRotation = 0) => {
    centerRef.current = center;
    startRotationRef.current = currentRotation;
    const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
    startAngleRef.current = angle;
  }, []);

  const updateRotation = useCallback((pointer) => {
    const center = centerRef.current;
    const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
    let delta = toDegrees(angle - startAngleRef.current);
    if (delta > 180) {
      delta -= 360;
    }
    if (delta < -180) {
      delta += 360;
    }
    return startRotationRef.current + delta;
  }, []);

  return {
    startRotation,
    updateRotation,
    normalizeAngle,
  };
};
