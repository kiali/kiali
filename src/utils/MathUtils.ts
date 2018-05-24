export const clamp = (x, min, max) => {
  return x < min ? min : x > max ? max : x;
};
