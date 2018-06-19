type Point = {
  x: number;
  y: number;
};

// Restricts value x to [min, max], if outside, moves to the nearest available value.
export const clamp = (x, min, max) => {
  return x < min ? min : x > max ? max : x;
};

// Computes the quadratic bezier value at time t [0,1]
export const quadraticBezier = (p0: Point, p1: Point, p2: Point, t: number) => {
  const k0 = Math.pow(1 - t, 2);
  const k1 = 2 * (1 - t) * t;
  const k2 = t * t;
  return {
    x: k0 * p0.x + k1 * p1.x + k2 * p2.x,
    y: k0 * p0.y + k1 * p1.y + k2 * p2.y
  };
};

// Computes a linear interpolation between 2 points at time t [0,1]
export const linearInterpolation = (p0: Point, p1: Point, t: number) => {
  return {
    x: p0.x + t * (p1.x - p0.x),
    y: p0.y + t * (p1.y - p0.y)
  };
};
