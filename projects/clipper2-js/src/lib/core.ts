/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  26 July 2023                                                    *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  Core structures and functions for the Clipper Library           *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/

import { PointInPolygonResult } from "./engine";

//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Core.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//

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

export interface IPoint64 {
  x: number;
  y: number;
}

//export interface IPointD {
//  x: number;
//  y: number;
//}

export class Path64 extends Array<IPoint64> {
  
  //constructor(capacity?: number);
  //constructor(path: Point64[]);
//  constructor(path?: Point64[]) {
//    super();

//    if (Array.isArray(path)) {
//      this.push(...path);
//    }
//  }


//  override toString(): string {
//    return this.map(p => p.toString()).join(' ');
//  }
}

export class Paths64 extends Array<Path64> {

  //constructor(capacity?: number);
  //constructor(paths: Path64[]);
  //constructor(paths?:  Path64[]) {
  //  super();
  //  if (Array.isArray(paths)) {
  //    this.push(...paths);
  //  }
  //}

  //override toString(): string {
  //  return this.map(p => p.toString()).join('\n');
  //}
}


export class PathD extends Array<IPoint64> {
  
  //constructor(capacity?: number);
  //constructor(path: PointD[]);
  //constructor(path?: PointD[]) {
  //  super();
  //  if (Array.isArray(path)) {
  //    this.push(...path);
  //  }
  //}

  //override toString(precision: number = 2): string {
  //  return this.map(p => p.toString(precision)).join(' ');
  //}
}

export class PathsD extends Array<PathD> {
  
  //constructor(capacity?: number);
  //constructor(paths: PathD[]);
  //constructor(paths?: PathD[]) {
  //  super();
  //  if (Array.isArray(paths)) {
  //    this.push(...paths);
  //  }
  //}

  //override toString(precision: number = 2): string {
  //  return this.map(p => p.toString(precision)).join('\n');
  //}
}


export class RectD {
  public left: number;
  public top: number;
  public right: number;
  public bottom: number;

  //constructor(l: number, t: number, r: number, b: number);
  //constructor(isValid: boolean);
  //constructor(rec: RectD);
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

  //constructor(l: number, t: number, r: number, b: number);
  //constructor(isValid: boolean);
  //constructor(rec: Rect64);
  constructor(lOrIsValidOrRec?: number | boolean | Rect64, t?: number, r?: number, b?: number) {
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
      this.left = lOrIsValidOrRec!.left;
      this.top = lOrIsValidOrRec!.top;
      this.right = lOrIsValidOrRec!.right;
      this.bottom = lOrIsValidOrRec!.bottom;
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

  public contains(pt: IPoint64): boolean {
    return pt.x > this.left && pt.x < this.right && pt.y > this.top && pt.y < this.bottom;
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



export class PointD implements IPoint64 {
  public x: number;
  public y: number;

  //constructor(pt: PointD | Point64);
  //constructor(pt: PointD | Point64, scale: number);
  //constructor(x: number, y: number);
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
      this.x = (<Point64>xOrPt).x * (yOrScale || 1);
      this.y = (<Point64>xOrPt).y * (yOrScale || 1);
    }
  }

  public toString(precision: number = 2): string {
    return `${this.x.toFixed(precision)},${this.y.toFixed(precision)}`;
  }

  public static equals(lhs: PointD, rhs: PointD): boolean {
    return InternalClipper.isAlmostZero(lhs.x - rhs.x) &&
      InternalClipper.isAlmostZero(lhs.y - rhs.y);
  }

  public static notEquals(lhs: PointD, rhs: PointD): boolean {
    return !InternalClipper.isAlmostZero(lhs.x - rhs.x) ||
      !InternalClipper.isAlmostZero(lhs.y - rhs.y);
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


export class Point64 implements IPoint64 {
  public x: number;
  public y: number;

  //constructor(pt: Point64 | PointD);
  //constructor(x: number, y: number);
  //constructor(pt: Point64 | PointD, scale?: number);
  constructor(xOrPt?: number | Point64 | PointD, yOrScale?: number) {
    if (typeof xOrPt === 'number' && typeof yOrScale === 'number') {
      this.x = Math.round(xOrPt);
      this.y = Math.round(yOrScale);
    } else if (xOrPt instanceof Point64) {
      if (yOrScale !== undefined) {
        this.x = Math.round(xOrPt.x * yOrScale);
        this.y = Math.round(xOrPt.y * yOrScale);
      } else {
        this.x = xOrPt.x;
        this.y = xOrPt.y;
      }
    } else {
      this.x = Math.round((<PointD>xOrPt).x * (yOrScale || 1));
      this.y = Math.round((<PointD>xOrPt).y * (yOrScale || 1));
    }
  }

  public static equals(lhs: Point64, rhs: Point64): boolean {
    return lhs.x === rhs.x && lhs.y === rhs.y;
  }

  public static notEquals(lhs: Point64, rhs: Point64): boolean {
    return lhs.x !== rhs.x || lhs.y !== rhs.y;
  }

  public static add(lhs: Point64, rhs: Point64): Point64 {
    return new Point64(lhs.x + rhs.x, lhs.y + rhs.y);
  }

  public static subtract(lhs: Point64, rhs: Point64): Point64 {
    return new Point64(lhs.x - rhs.x, lhs.y - rhs.y);
  }

  public toString(): string {
    return `${this.x},${this.y} `;
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

export class InternalClipper {
  static readonly MaxInt64: number = 9223372036854775807;
  static readonly MaxCoord: number = InternalClipper.MaxInt64 / 4;
  static readonly max_coord: number = InternalClipper.MaxCoord;
  static readonly min_coord: number = -InternalClipper.MaxCoord;
  static readonly Invalid64: number = InternalClipper.MaxInt64;

  static readonly defaultArcTolerance: number = 0.25;
  static readonly floatingPointTolerance: number = 1E-12;
  static readonly defaultMinimumEdgeLength: number = 0.1;

  private static readonly precision_range_error: string = "Error: Precision is out of range.";

  static checkPrecision(precision: number): void {
    if (precision < -8 || precision > 8)
      throw new Error(this.precision_range_error);
  }

  static isAlmostZero(value: number): boolean {
    return (Math.abs(value) <= this.floatingPointTolerance);
  }

  static crossProduct(pt1: IPoint64, pt2: IPoint64, pt3: IPoint64): number {
    return ((pt2.x - pt1.x) * (pt3.y - pt2.y) - (pt2.y - pt1.y) * (pt3.x - pt2.x));
  }

  static dotProduct(pt1: IPoint64, pt2: IPoint64, pt3: IPoint64): number {
    return ((pt2.x - pt1.x) * (pt3.x - pt2.x) + (pt2.y - pt1.y) * (pt3.y - pt2.y));
  }

  static crossProductPointD(vec1: PointD, vec2: PointD): number {
    return (vec1.y * vec2.x - vec2.y * vec1.x);
  }

  static dotProductPointD(vec1: PointD, vec2: PointD): number {
    return (vec1.x * vec2.x + vec1.y * vec2.y);
  }

  static checkCastInt64(val: number): number {
    if ((val >= this.max_coord) || (val <= this.min_coord)) return this.Invalid64;
    return Math.round(val);
  }


  public static getIntersectPt(ln1a: IPoint64, ln1b: IPoint64, ln2a: IPoint64, ln2b: IPoint64): { ip: IPoint64, success: boolean } {
    const dy1 = ln1b.y - ln1a.y;
    const dx1 = ln1b.x - ln1a.x;
    const dy2 = ln2b.y - ln2a.y;
    const dx2 = ln2b.x - ln2a.x;
    const det = dy1 * dx2 - dy2 * dx1;

    let ip: IPoint64;

    if (det === 0.0) {
      ip = new Point64(0, 0);
      return { ip, success: false };
    }

    const t = ((ln1a.x - ln2a.x) * dy2 - (ln1a.y - ln2a.y) * dx2) / det;
    if (t <= 0.0) ip = ln1a;
    else if (t >= 1.0) ip = ln1b;
    else ip = new Point64(ln1a.x + t * dx1, ln1a.y + t * dy1);
    return { ip, success: true };
  }

  public static getIntersectPoint(ln1a: Point64, ln1b: IPoint64, ln2a: Point64, ln2b: IPoint64): { ip: Point64, success: boolean } {
    const dy1 = ln1b.y - ln1a.y;
    const dx1 = ln1b.x - ln1a.x;
    const dy2 = ln2b.y - ln2a.y;
    const dx2 = ln2b.x - ln2a.x;
    const det = dy1 * dx2 - dy2 * dx1;

    let ip: Point64;

    if (det === 0.0) {
      ip = new Point64(0, 0);
      return { ip, success: false };
    }

    const t = ((ln1a.x - ln2a.x) * dy2 - (ln1a.y - ln2a.y) * dx2) / det;
    if (t <= 0.0) ip = ln1a;
    else if (t >= 1.0) ip = ln2a;
    else ip = new Point64(ln1a.x + t * dx1, ln1a.y + t * dy1);
    return { ip, success: true };
  }

  public static segsIntersect(seg1a: IPoint64, seg1b: IPoint64, seg2a: IPoint64, seg2b: IPoint64, inclusive: boolean = false): boolean {
    if (inclusive) {
      const res1 = InternalClipper.crossProduct(seg1a, seg2a, seg2b);
      const res2 = InternalClipper.crossProduct(seg1b, seg2a, seg2b);
      if (res1 * res2 > 0) return false;
      const res3 = InternalClipper.crossProduct(seg2a, seg1a, seg1b);
      const res4 = InternalClipper.crossProduct(seg2b, seg1a, seg1b);
      if (res3 * res4 > 0) return false;
      return (res1 !== 0 || res2 !== 0 || res3 !== 0 || res4 !== 0);
    } else {
      return (InternalClipper.crossProduct(seg1a, seg2a, seg2b) * InternalClipper.crossProduct(seg1b, seg2a, seg2b) < 0) &&
        (InternalClipper.crossProduct(seg2a, seg1a, seg1b) * InternalClipper.crossProduct(seg2b, seg1a, seg1b) < 0);
    }
  }

  public static getClosestPtOnSegment(offPt: IPoint64, seg1: Point64, seg2: Point64): Point64 {
    if (seg1.x === seg2.x && seg1.y === seg2.y) return seg1;
    const dx = seg2.x - seg1.x;
    const dy = seg2.y - seg1.y;
    let q = ((offPt.x - seg1.x) * dx + (offPt.y - seg1.y) * dy) / ((dx * dx) + (dy * dy));
    if (q < 0) q = 0; else if (q > 1) q = 1;
    return new Point64(seg1.x + Math.round(q * dx), seg1.y + Math.round(q * dy));
  }

  public static pointInPolygon(pt: IPoint64, polygon: Path64): PointInPolygonResult {
    const len = polygon.length;
    let start = 0;

    if (len < 3) return PointInPolygonResult.IsOutside;

    while (start < len && polygon[start].y === pt.y) start++;
    if (start === len) return PointInPolygonResult.IsOutside;

    let d: number = 0;
    let isAbove = polygon[start].y < pt.y;
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
        while (i < end && polygon[i].y < pt.y) i++;
        if (i === end) continue;
      } else {
        while (i < end && polygon[i].y > pt.y) i++;
        if (i === end) continue;
      }

      const curr = polygon[i];
      const prev = i > 0 ? polygon[i - 1] : polygon[len - 1];

      if (curr.y === pt.y) {
        if (curr.x === pt.x || (curr.y === prev.y && (pt.x < prev.x !== pt.x < curr.x))) return PointInPolygonResult.IsOn;
        i++;
        if (i === start) break;
        continue;
      }

      if (pt.x < curr.x && pt.x < prev.x) {
        // we're only interested in edges crossing on the left
      } else if (pt.x > prev.x && pt.x > curr.x) {
        val = 1 - val; // toggle val
      } else {
        d = InternalClipper.crossProduct(prev, curr, pt);
        if (d === 0) return PointInPolygonResult.IsOn;
        if ((d < 0) === isAbove) val = 1 - val;
      }
      isAbove = !isAbove;
      i++;
    }

    if (isAbove !== startingAbove) {
      if (i === len) i = 0;
      else d = InternalClipper.crossProduct(polygon[i - 1], polygon[i], pt);
      if (d === 0) return PointInPolygonResult.IsOn;
      if ((d < 0) === isAbove) val = 1 - val;
    }

    if (val === 0) return PointInPolygonResult.IsOutside;
    return PointInPolygonResult.IsInside;
  }
}
