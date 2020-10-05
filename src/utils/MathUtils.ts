export interface Point {
  x: number;
  y: number;
}

type Vector = Point;

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

// Computes the length of a bezier path
// https://stackoverflow.com/questions/11854907/calculate-the-length-of-a-segment-of-a-quadratic-bezier
// http://www.malczak.linuxpl.com/blog/quadratic-bezier-curve-length/
export const bezierLength = (p0: Point, p1: Point, p2: Point) => {
  const a: Point = {
    x: p0.x - 2 * p1.x + p2.x,
    y: p0.y - 2 * p1.y + p2.y
  };
  const b: Point = {
    x: 2 * p1.x - 2 * p0.x,
    y: 2 * p1.y - 2 * p0.y
  };
  const A = 4 * (a.x * a.x + a.y * a.y);
  const B = 4 * (a.x * b.x + a.y * b.y);
  const C = b.x * b.x + b.y * b.y;

  const Sabc = 2 * Math.sqrt(A + B + C);
  const A_2 = Math.sqrt(A);
  const A_32 = 2 * A * A_2;
  const C_2 = 2 * Math.sqrt(C);
  const BA = B / A_2;
  return (
    (A_32 * Sabc + A_2 * B * (Sabc - C_2) + (4 * C * A - B * B) * Math.log((2 * A_2 + BA + Sabc) / (BA + C_2))) /
    (4 * A_32)
  );
};

export const distance = (p0: Point, p1: Point) => {
  return Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
};

export const squaredDistance = (p0: Point, p1: Point) => {
  return Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2);
};

export const normalize = (v1: Vector): Vector => {
  const norm = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  return {
    x: v1.x / norm,
    y: v1.y / norm
  };
};

// http://www.euclideanspace.com/maths/algebra/vectors/angleBetween/index.htm
export const angleBetweenVectors = (v1: Vector, v2: Vector) => {
  return Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
};

export const average = <U>(arr: U[], f: (u: U) => number): number | undefined => {
  return arr.length > 0 ? arr.reduce((agg, cur) => agg + f(cur), 0) / arr.length : undefined;
};
