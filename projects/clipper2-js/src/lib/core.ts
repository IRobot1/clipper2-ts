/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  26 July 2023                                                    *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  Core structures and functions for the Clipper Library           *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/

//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Core.cs
// Converted by ChatGPT August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//
// ChatGTP has few points to note:
//
// Properties in C# can be replicated with getters and setters in TypeScript.
// C# attributes like[MethodImpl(MethodImplOptions.AggressiveInlining)] don't have a direct TypeScript equivalent. TypeScript (and JavaScript) doesn't provide control over inlining at this level.So, I removed them.
// internal in C# implies module / package - level visibility.In TypeScript, the default visibility is public, but you can use private or protected to restrict visibility.If you're working with ES6 modules, you could achieve module-level visibility by not exporting types or functions.
// The C# Exception class is replaced with the standard JavaScript Error class.
// TypeScript does not have out parameters, so I've changed the methods to return an object with the intersection point and a boolean indicating if the intersection was successful.
// I've handled the overloaded constructors using TypeScript's ability to define multiple constructor signatures.
// For the GetHashCode method, since JavaScript does not have the same concept of hash codes like C#, I've used a simple XOR operation for the two values. This might not provide optimal hash distribution, but it's a basic approach you can start with.Adjust as needed based on your use case.
// I converted the struct to a class, handled operator overloads as static functions
// JavaScript (and TypeScript) does not have structs or the long type. The closest representation for numbers is just the number type.
// In TypeScript, arrays are usually extended using the built-in Array<T> class. The List<T> class from C# can be represented as the Array<T> class in TypeScript.
// The foreach loop in C# is translated to the map function in TypeScript.
// The constructors handle both capacity (which doesn't have a direct equivalent in JavaScript or TypeScript, so it's effectively ignored)

// Note: all clipping operations except for Difference are commutative.
export enum ClipType {
  None,
  Intersection,
  Union,
  Difference,
  Xor
}

export enum PathType {
  Subject,
  Clip
}

// By far the most widely used filling rules for polygons are EvenOdd
// and NonZero, sometimes called Alternate and Winding respectively.
// https://en.wikipedia.org/wiki/Nonzero-rule
export enum FillRule {
  EvenOdd,
  NonZero,
  Positive,
  Negative
}

// PointInPolygon
export enum PipResult {
  Inside,
  Outside,
  OnEdge
}

export class Path64 extends Array<Point64> {
  
  constructor(capacity?: number);
  constructor(path: Point64[]);
  constructor(capacityOrPath?: number | Point64[]) {
    super();
    if (Array.isArray(capacityOrPath)) {
      this.push(...capacityOrPath);
    }
  }

  override toString(): string {
    return this.map(p => p.toString()).join(' ');
  }
}

export class Paths64 extends Array<Path64> {

  constructor(capacity?: number);
  constructor(paths: Path64[]);
  constructor(capacityOrPaths?: number | Path64[]) {
    super();
    if (Array.isArray(capacityOrPaths)) {
      this.push(...capacityOrPaths);
    }
  }

  override toString(): string {
    return this.map(p => p.toString()).join('\n');
  }
}

export class PathD extends Array<PointD> {
  
  constructor(capacity?: number);
  constructor(path: PointD[]);
  constructor(capacityOrPath?: number | PointD[]) {
    super();
    if (Array.isArray(capacityOrPath)) {
      this.push(...capacityOrPath);
    }
  }

  override toString(precision: number = 2): string {
    return this.map(p => p.toString(precision)).join(' ');
  }
}

export class PathsD extends Array<PathD> {
  
  constructor(capacity?: number);
  constructor(paths: PathD[]);
  constructor(capacityOrPaths?: number | PathD[]) {
    super();
    if (Array.isArray(capacityOrPaths)) {
      this.push(...capacityOrPaths);
    }
  }

  override toString(precision: number = 2): string {
    return this.map(p => p.toString(precision)).join('\n');
  }
}


export class RectD {
  public left: number;
  public top: number;
  public right: number;
  public bottom: number;

  constructor(l: number, t: number, r: number, b: number);
  constructor(isValid: boolean);
  constructor(rec: RectD);
  constructor(lOrIsValidOrRec: number | boolean | RectD, t?: number, r?: number, b?: number) {
    if (typeof lOrIsValidOrRec === 'boolean') {
      if (lOrIsValidOrRec) {
        this.left = 0;
        this.top = 0;
        this.right = 0;
        this.bottom = 0;
      } else {
        this.left = Number.MAX_VALUE;
        this.top = Number.MAX_VALUE;
        this.right = -Number.MAX_VALUE;
        this.bottom = -Number.MAX_VALUE;
      }
    } else if (typeof lOrIsValidOrRec === 'number') {
      this.left = lOrIsValidOrRec;
      this.top = t as number;
      this.right = r as number;
      this.bottom = b as number;
    } else {
      this.left = lOrIsValidOrRec.left;
      this.top = lOrIsValidOrRec.top;
      this.right = lOrIsValidOrRec.right;
      this.bottom = lOrIsValidOrRec.bottom;
    }
  }

  public get width(): number {
    return this.right - this.left;
  }

  public set width(value: number) {
    this.right = this.left + value;
  }

  public get height(): number {
    return this.bottom - this.top;
  }

  public set height(value: number) {
    this.bottom = this.top + value;
  }

  public isEmpty(): boolean {
    return this.bottom <= this.top || this.right <= this.left;
  }

  public midPoint(): PointD {
    return new PointD((this.left + this.right) / 2, (this.top + this.bottom) / 2);
  }

  public contains(pt: PointD): boolean {
    return pt.x > this.left && pt.x < this.right && pt.y > this.top && pt.y < this.bottom;
  }

  public containsRect(rec: RectD): boolean {
    return rec.left >= this.left && rec.right <= this.right && rec.top >= this.top && rec.bottom <= this.bottom;
  }

  public intersects(rec: RectD): boolean {
    return (Math.max(this.left, rec.left) < Math.min(this.right, rec.right)) &&
      (Math.max(this.top, rec.top) < Math.min(this.bottom, rec.bottom));
  }

  public asPath(): PathD {
    let result = new PathD(4);
    result.push(new PointD(this.left, this.top));
    result.push(new PointD(this.right, this.top));
    result.push(new PointD(this.right, this.bottom));
    result.push(new PointD(this.left, this.bottom));
    return result;
  }
}


export class Rect64 {
  public left: number;
  public top: number;
  public right: number;
  public bottom: number;

  constructor(l: number, t: number, r: number, b: number);
  constructor(isValid: boolean);
  constructor(rec: Rect64);
  constructor(lOrIsValidOrRec: number | boolean | Rect64, t?: number, r?: number, b?: number) {
    if (typeof lOrIsValidOrRec === 'boolean') {
      if (lOrIsValidOrRec) {
        this.left = 0;
        this.top = 0;
        this.right = 0;
        this.bottom = 0;
      } else {
        this.left = Number.MAX_SAFE_INTEGER;
        this.top = Number.MAX_SAFE_INTEGER;
        this.right = Number.MIN_SAFE_INTEGER;
        this.bottom = Number.MIN_SAFE_INTEGER;
      }
    } else if (typeof lOrIsValidOrRec === 'number') {
      this.left = lOrIsValidOrRec;
      this.top = t as number;
      this.right = r as number;
      this.bottom = b as number;
    } else {
      this.left = lOrIsValidOrRec.left;
      this.top = lOrIsValidOrRec.top;
      this.right = lOrIsValidOrRec.right;
      this.bottom = lOrIsValidOrRec.bottom;
    }
  }

  public get width(): number {
    return this.right - this.left;
  }

  public set width(value: number) {
    this.right = this.left + value;
  }

  public get height(): number {
    return this.bottom - this.top;
  }

  public set height(value: number) {
    this.bottom = this.top + value;
  }

  public isEmpty(): boolean {
    return this.bottom <= this.top || this.right <= this.left;
  }

  public midPoint(): Point64 {
    return new Point64((this.left + this.right) / 2, (this.top + this.bottom) / 2);
  }

  public contains(pt: Point64): boolean {
    return pt.X > this.left && pt.X < this.right && pt.Y > this.top && pt.Y < this.bottom;
  }

  public containsRect(rec: Rect64): boolean {
    return rec.left >= this.left && rec.right <= this.right && rec.top >= this.top && rec.bottom <= this.bottom;
  }

  public intersects(rec: Rect64): boolean {
    return (Math.max(this.left, rec.left) <= Math.min(this.right, rec.right)) &&
      (Math.max(this.top, rec.top) <= Math.min(this.bottom, rec.bottom));
  }

  public asPath(): Path64 {
    let result = new Path64(4);
    result.push(new Point64(this.left, this.top));
    result.push(new Point64(this.right, this.top));
    result.push(new Point64(this.right, this.bottom));
    result.push(new Point64(this.left, this.bottom));
    return result;
  }
}


export class PointD {
  public x: number;
  public y: number;

  constructor(pt: PointD | Point64);
  constructor(pt: PointD | Point64, scale: number);
  constructor(x: number, y: number);
  constructor(xOrPt: number | PointD | Point64, yOrScale?: number) {
    if (typeof xOrPt === 'number' && typeof yOrScale === 'number') {
      this.x = xOrPt;
      this.y = yOrScale;
    } else if (xOrPt instanceof PointD) {
      if (yOrScale !== undefined) {
        this.x = xOrPt.x * yOrScale;
        this.y = xOrPt.y * yOrScale;
      } else {
        this.x = xOrPt.x;
        this.y = xOrPt.y;
      }
    } else {
      this.x = (<Point64>xOrPt).X * (yOrScale || 1);
      this.y = (<Point64>xOrPt).Y * (yOrScale || 1);
    }
  }

  public toString(precision: number = 2): string {
    return `${this.x.toFixed(precision)},${this.y.toFixed(precision)}`;
  }

  public static equals(lhs: PointD, rhs: PointD): boolean {
    return InternalClipper.IsAlmostZero(lhs.x - rhs.x) &&
      InternalClipper.IsAlmostZero(lhs.y - rhs.y);
  }

  public static notEquals(lhs: PointD, rhs: PointD): boolean {
    return !InternalClipper.IsAlmostZero(lhs.x - rhs.x) ||
      !InternalClipper.IsAlmostZero(lhs.y - rhs.y);
  }

  public equals(obj: any): boolean {
    if (obj instanceof PointD) {
      return PointD.equals(this, obj);
    }
    return false;
  }

  public negate(): void {
    this.x = -this.x;
    this.y = -this.y;
  }

//  public getHashCode(): number {
//    return this.x ^ this.y;  // XOR-based hash combination. Adjust if needed.
//  }
}

export class Point64 {
  public X: number;
  public Y: number;

  constructor(pt: Point64 | PointD);
  constructor(x: number, y: number);
  constructor(pt: Point64 | PointD, scale?: number);
  constructor(xOrPt: number | Point64 | PointD, yOrScale?: number) {
    if (typeof xOrPt === 'number' && typeof yOrScale === 'number') {
      this.X = Math.round(xOrPt);
      this.Y = Math.round(yOrScale);
    } else if (xOrPt instanceof Point64) {
      if (yOrScale !== undefined) {
        this.X = Math.round(xOrPt.X * yOrScale);
        this.Y = Math.round(xOrPt.Y * yOrScale);
      } else {
        this.X = xOrPt.X;
        this.Y = xOrPt.Y;
      }
    } else {
      this.X = Math.round((<PointD>xOrPt).x * (yOrScale || 1));
      this.Y = Math.round((<PointD>xOrPt).y * (yOrScale || 1));
    }
  }

  public static equals(lhs: Point64, rhs: Point64): boolean {
    return lhs.X === rhs.X && lhs.Y === rhs.Y;
  }

  public static notEquals(lhs: Point64, rhs: Point64): boolean {
    return lhs.X !== rhs.X || lhs.Y !== rhs.Y;
  }

  public static add(lhs: Point64, rhs: Point64): Point64 {
    return new Point64(lhs.X + rhs.X, lhs.Y + rhs.Y);
  }

  public static subtract(lhs: Point64, rhs: Point64): Point64 {
    return new Point64(lhs.X - rhs.X, lhs.Y - rhs.Y);
  }

  public toString(): string {
    return `${this.X},${this.Y} `;
  }

  public equals(obj: any): boolean {
    if (obj instanceof Point64) {
      return Point64.equals(this, obj);
    }
    return false;
  }

//  public getHashCode(): number {
//    return this.X ^ this.Y;  // Simple XOR-based hash combination. Adjust if needed.
//  }
}

export enum PointInPolygonResult {
  IsInside,
  IsOutside,
  IsOn
}

class InternalClipper {
  static readonly MaxInt64: number = 9223372036854775807;
  static readonly MaxCoord: number = InternalClipper.MaxInt64 / 4;
  static readonly max_coord: number = InternalClipper.MaxCoord;
  static readonly min_coord: number = -InternalClipper.MaxCoord;
  static readonly Invalid64: number = InternalClipper.MaxInt64;

  static readonly defaultArcTolerance: number = 0.25;
  static readonly floatingPointTolerance: number = 1E-12;
  static readonly defaultMinimumEdgeLength: number = 0.1;

  private static readonly precision_range_error: string = "Error: Precision is out of range.";

  static CheckPrecision(precision: number): void {
    if (precision < -8 || precision > 8)
      throw new Error(this.precision_range_error);
  }

  static IsAlmostZero(value: number): boolean {
    return (Math.abs(value) <= this.floatingPointTolerance);
  }

  static CrossProduct(pt1: Point64, pt2: Point64, pt3: Point64): number {
    return ((pt2.X - pt1.X) * (pt3.Y - pt2.Y) - (pt2.Y - pt1.Y) * (pt3.X - pt2.X));
  }

  static DotProduct(pt1: Point64, pt2: Point64, pt3: Point64): number {
    return ((pt2.X - pt1.X) * (pt3.X - pt2.X) + (pt2.Y - pt1.Y) * (pt3.Y - pt2.Y));
  }

  static CrossProductPointD(vec1: PointD, vec2: PointD): number {
    return (vec1.y * vec2.x - vec2.y * vec1.x);
  }

  static DotProductPointD(vec1: PointD, vec2: PointD): number {
    return (vec1.x * vec2.x + vec1.y * vec2.y);
  }

  static CheckCastInt64(val: number): number {
    if ((val >= this.max_coord) || (val <= this.min_coord)) return this.Invalid64;
    return Math.round(val);
  }


  public static getIntersectPt(ln1a: Point64, ln1b: Point64, ln2a: Point64, ln2b: Point64): { ip: Point64, success: boolean } {
    const dy1 = ln1b.Y - ln1a.Y;
    const dx1 = ln1b.X - ln1a.X;
    const dy2 = ln2b.Y - ln2a.Y;
    const dx2 = ln2b.X - ln2a.X;
    const det = dy1 * dx2 - dy2 * dx1;

    let ip: Point64;

    if (det === 0.0) {
      ip = new Point64(0, 0);
      return { ip, success: false };
    }

    const t = ((ln1a.X - ln2a.X) * dy2 - (ln1a.Y - ln2a.Y) * dx2) / det;
    if (t <= 0.0) ip = ln1a;
    else if (t >= 1.0) ip = ln1b;
    else ip = new Point64(ln1a.X + t * dx1, ln1a.Y + t * dy1);
    return { ip, success: true };
  }

  public static getIntersectPoint(ln1a: Point64, ln1b: Point64, ln2a: Point64, ln2b: Point64): { ip: Point64, success: boolean } {
    const dy1 = ln1b.Y - ln1a.Y;
    const dx1 = ln1b.X - ln1a.X;
    const dy2 = ln2b.Y - ln2a.Y;
    const dx2 = ln2b.X - ln2a.X;
    const det = dy1 * dx2 - dy2 * dx1;

    let ip: Point64;

    if (det === 0.0) {
      ip = new Point64(0, 0);
      return { ip, success: false };
    }

    const t = ((ln1a.X - ln2a.X) * dy2 - (ln1a.Y - ln2a.Y) * dx2) / det;
    if (t <= 0.0) ip = ln1a;
    else if (t >= 1.0) ip = ln2a;
    else ip = new Point64(ln1a.X + t * dx1, ln1a.Y + t * dy1);
    return { ip, success: true };
  }

  public static segsIntersect(seg1a: Point64, seg1b: Point64, seg2a: Point64, seg2b: Point64, inclusive: boolean = false): boolean {
    if (inclusive) {
      const res1 = InternalClipper.CrossProduct(seg1a, seg2a, seg2b);
      const res2 = InternalClipper.CrossProduct(seg1b, seg2a, seg2b);
      if (res1 * res2 > 0) return false;
      const res3 = InternalClipper.CrossProduct(seg2a, seg1a, seg1b);
      const res4 = InternalClipper.CrossProduct(seg2b, seg1a, seg1b);
      if (res3 * res4 > 0) return false;
      return (res1 !== 0 || res2 !== 0 || res3 !== 0 || res4 !== 0);
    } else {
      return (InternalClipper.CrossProduct(seg1a, seg2a, seg2b) * InternalClipper.CrossProduct(seg1b, seg2a, seg2b) < 0) &&
        (InternalClipper.CrossProduct(seg2a, seg1a, seg1b) * InternalClipper.CrossProduct(seg2b, seg1a, seg1b) < 0);
    }
  }

  public static getClosestPtOnSegment(offPt: Point64, seg1: Point64, seg2: Point64): Point64 {
    if (seg1.X === seg2.X && seg1.Y === seg2.Y) return seg1;
    const dx = seg2.X - seg1.X;
    const dy = seg2.Y - seg1.Y;
    let q = ((offPt.X - seg1.X) * dx + (offPt.Y - seg1.Y) * dy) / ((dx * dx) + (dy * dy));
    if (q < 0) q = 0; else if (q > 1) q = 1;
    return new Point64(seg1.X + Math.round(q * dx), seg1.Y + Math.round(q * dy));
  }

  public static pointInPolygon(pt: Point64, polygon: Path64): PointInPolygonResult {
    const len = polygon.length;
    let start = 0;

    if (len < 3) return PointInPolygonResult.IsOutside;

    while (start < len && polygon[start].Y === pt.Y) start++;
    if (start === len) return PointInPolygonResult.IsOutside;

    let d: number = 0;
    let isAbove = polygon[start].Y < pt.Y;
    const startingAbove = isAbove;
    let val = 0;
    let i = start + 1;
    let end = len;

    while (true) {
      if (i === end) {
        if (end === 0 || start === 0) break;
        end = start;
        i = 0;
      }

      if (isAbove) {
        while (i < end && polygon[i].Y < pt.Y) i++;
        if (i === end) continue;
      } else {
        while (i < end && polygon[i].Y > pt.Y) i++;
        if (i === end) continue;
      }

      const curr = polygon[i];
      const prev = i > 0 ? polygon[i - 1] : polygon[len - 1];

      if (curr.Y === pt.Y) {
        if (curr.X === pt.X || (curr.Y === prev.Y && (pt.X < prev.X !== pt.X < curr.X))) return PointInPolygonResult.IsOn;
        i++;
        if (i === start) break;
        continue;
      }

      if (pt.X < curr.X && pt.X < prev.X) {
        // we're only interested in edges crossing on the left
      } else if (pt.X > prev.X && pt.X > curr.X) {
        val = 1 - val; // toggle val
      } else {
        d = InternalClipper.CrossProduct(prev, curr, pt);
        if (d === 0) return PointInPolygonResult.IsOn;
        if ((d < 0) === isAbove) val = 1 - val;
      }
      isAbove = !isAbove;
      i++;
    }

    if (isAbove !== startingAbove) {
      if (i === len) i = 0;
      else d = InternalClipper.CrossProduct(polygon[i - 1], polygon[i], pt);
      if (d === 0) return PointInPolygonResult.IsOn;
      if ((d < 0) === isAbove) val = 1 - val;
    }

    if (val === 0) return PointInPolygonResult.IsOutside;
    return PointInPolygonResult.IsInside;
  }
}
