/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  16 July 2023                                                    *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  This module contains simple functions that will likely cover    *
*              most polygon boolean and offsetting needs, while also avoiding  *
*              the inherent complexities of the other modules.                 *
* Thanks    :  Special thanks to Thong Nguyen, Guus Kuiper, Phil Stopford,     *
*           :  and Daniel Gosnell for their invaluable assistance with C#.     *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/

//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//

import { ClipType, FillRule, IPoint64, InternalClipper, Path64, PathType, Paths64, Point64, Rect64 } from "./core";
import { Clipper64, PointInPolygonResult, PolyPath64, PolyTree64 } from "./engine";
import { Minkowski } from "./minkowski";
import { ClipperOffset, EndType, JoinType } from "./offset";
import { RectClip64, RectClipLines64 } from "./rectclip";

export class Clipper {

  private static invalidRect64: Rect64 = new Rect64(false);
  public static get InvalidRect64(): Rect64 {
    return this.invalidRect64;
  }

  public static Intersect(subject: Paths64, clip: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Intersection, subject, clip, fillRule);
  }

  public static Union(subject: Paths64, clip?: Paths64, fillRule= FillRule.EvenOdd): Paths64 {
    return this.BooleanOp(ClipType.Union, subject, clip, fillRule);
  }

  public static Difference(subject: Paths64, clip: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Difference, subject, clip, fillRule);
  }

  public static Xor(subject: Paths64, clip: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Xor, subject, clip, fillRule);
  }

  public static BooleanOp(clipType: ClipType, subject?: Paths64, clip?: Paths64, fillRule = FillRule.EvenOdd): Paths64 {
    const solution: Paths64 = new Paths64();
    if (!subject) return solution;
    const c: Clipper64 = new Clipper64();
    c.addPaths(subject, PathType.Subject);
    if (clip)
      c.addPaths(clip, PathType.Clip);
    c.execute(clipType, fillRule, solution);
    return solution;
  }

  //public static BooleanOp(clipType: ClipType, subject: Paths64, clip: Paths64, polytree: PolyTree64, fillRule: FillRule): void {
  //  if (!subject) return;
  //  const c: Clipper64 = new Clipper64();
  //  c.addPaths(subject, PathType.Subject);
  //  if (clip)
  //    c.addPaths(clip, PathType.Clip);
  //  c.execute(clipType, fillRule, polytree);
  //}

  public static InflatePaths(paths: Paths64, delta: number, joinType: JoinType, endType: EndType, miterLimit: number = 2.0): Paths64 {
    const co: ClipperOffset = new ClipperOffset(miterLimit);
    co.addPaths(paths, joinType, endType);
    const solution: Paths64 = new Paths64();
    co.execute(delta, solution);
    return solution;
  }

  public static RectClip(rect: Rect64, paths: Paths64): Paths64 {
    if (rect.isEmpty() || paths.length === 0) return new Paths64();
    const rc = new RectClip64(rect);
    return rc.execute(paths);
  }

  public static RectClip(rect: Rect64, path: Path64): Paths64 {
    if (rect.isEmpty() || path.length === 0) return new Paths64();
    const tmp: Paths64 = new Paths64();
    tmp.push(path);
    return this.RectClip(rect, tmp);
  }

  public static RectClipLines(rect: Rect64, paths: Paths64): Paths64 {
    if (rect.isEmpty() || paths.length === 0) return new Paths64();
    const rc = new RectClipLines64(rect);
    return rc.execute(paths);
  }

  public static RectClipLines(rect: Rect64, path: Path64): Paths64 {
    if (rect.isEmpty() || path.length === 0) return new Paths64();
    const tmp: Paths64 = new Paths64();
    tmp.push(path);
    return this.RectClipLines(rect, tmp);
  }

  public static MinkowskiSum(pattern: Path64, path: Path64, isClosed: boolean): Paths64 {
    return Minkowski.sum(pattern, path, isClosed);
  }

  public static MinkowskiDiff(pattern: Path64, path: Path64, isClosed: boolean): Paths64 {
    return Minkowski.diff(pattern, path, isClosed);
  }

  public static area(path: Path64): number {
    // https://en.wikipedia.org/wiki/Shoelace_formula
    let a = 0.0;
    const cnt = path.length;
    if (cnt < 3) return 0.0;
    let prevPt = path[cnt - 1];
    for (let pt of path) {
      a += (prevPt.y + pt.y) * (prevPt.x - pt.x);
      prevPt = pt;
    }
    return a * 0.5;
  }

  public static area(paths: Paths64): number {
    let a = 0.0;
    for (let path of paths)
      a += this.area(path);
    return a;
  }

  public static isPositive(poly: Path64): boolean {
    return this.area(poly) >= 0;
  }

  public static path64ToString(path: Path64): string {
    let result = "";
    for (let pt of path)
      result += pt.toString();
    return result + '\n';
  }

  public static paths64ToString(paths: Paths64): string {
    let result = "";
    for (let path of paths)
      result += this.path64ToString(path);
    return result;
  }

  public static offsetPath(path: Path64, dx: number, dy: number): Path64 {
    const result = new Path64(path.length);
    for (let pt of path)
      result.push(new Point64(pt.x + dx, pt.y + dy));
    return result;
  }

  public static scalePoint64(pt: Point64, scale: number): Point64 {
    const result = new Point64(
      Math.round(pt.x * scale),
      Math.round(pt.y * scale)
    )
    return result;
  }

  public static scalePath(path: Path64, scale: number): Path64 {
    if (InternalClipper.isAlmostZero(scale - 1)) return path;
    const result: Path64 = [];
    for (const pt of path)
      result.push({ x: pt.x * scale, y: pt.y * scale });
    return result;
  }

  public static scalePaths(paths: Paths64, scale: number): Paths64 {
    if (InternalClipper.isAlmostZero(scale - 1)) return paths;
    const result: Paths64 = [];
    for (const path of paths)
      result.push(this.scalePath(path, scale));
    return result;
  }

  public static translatePath(path: Path64, dx: number, dy: number): Path64 {
    const result: Path64 = [];
    for (const pt of path) {
      result.push({ x: pt.x + dx, y: pt.y + dy });
    }
    return result;
  }

  public static translatePaths(paths: Paths64, dx: number, dy: number): Paths64 {
    const result: Paths64 = [];
    for (const path of paths) {
      result.push(this.translatePath(path, dx, dy));
    }
    return result;
  }

  public static reversePath(path: Path64): Path64 {
    return [...path].reverse();
  }

  public static reversePaths(paths: Paths64): Paths64 {
    const result: Paths64 = [];
    for (const t of paths) {
      result.push(this.reversePath(t));
    }
    return result;
  }

  public static getBounds(path: Path64): Rect64 {
    const result: Rect64 = Clipper.InvalidRect64;
    for (const pt of path) {
      if (pt.x < result.left) result.left = pt.x;
      if (pt.x > result.right) result.right = pt.x;
      if (pt.y < result.top) result.top = pt.y;
      if (pt.y > result.bottom) result.bottom = pt.y;
    }
    return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, right: 0, top: 0, bottom: 0 } : result;
  }

  public static getBounds(paths: Paths64): Rect64 {
    const result: Rect64 = Clipper.InvalidRect64;
    for (const path of paths) {
      for (const pt of path) {
        if (pt.x < result.left) result.left = pt.x;
        if (pt.x > result.right) result.right = pt.x;
        if (pt.y < result.top) result.top = pt.y;
        if (pt.y > result.bottom) result.bottom = pt.y;
      }
    }
    return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, right: 0, top: 0, bottom: 0 } : result;
  }

  static makePath(arr: number[]): Path64 {
    let len = arr.length / 2;
    let p = new Path64(len);
    for (let i = 0; i < len; i++)
      p.push(new Point64(arr[i * 2], arr[i * 2 + 1]));
    return p;
  }

  static makePath(arr: bigint[]): Path64 {
    let len = arr.length / 2;
    let p = new Path64(len);
    for (let i = 0; i < len; i++)
      p.push(new Point64(Number(arr[i * 2]), Number(arr[i * 2 + 1])));
    return p;
  }

  static stripDuplicates(path: Path64, isClosedPath: boolean): Path64 {
    let cnt = path.length;
    let result = new Path64(cnt);
    if (cnt === 0) return result;
    let lastPt = path[0];
    result.push(lastPt);
    for (let i = 1; i < cnt; i++)
      if (lastPt !== path[i]) {
        lastPt = path[i];
        result.push(lastPt);
      }
    if (isClosedPath && lastPt === result[0])
      result.pop();
    return result;
  }

  private static addPolyNodeToPaths(polyPath: PolyPath64, paths: Paths64): void {
    if (polyPath.Polygon && polyPath.Polygon.length > 0)
      paths.push(polyPath.Polygon);
    for (let i = 0; i < polyPath.Count; i++)
      this.addPolyNodeToPaths(polyPath._childs[i], paths);
  }

  public static polyTreeToPaths64(polyTree: PolyTree64): Paths64 {
    const result: Paths64 = new Paths64();
    for (let i = 0; i < polyTree.count; i++) {
      addPolyNodeToPaths(polyTree._childs[i] as PolyPath64, result);
    }
    return result;
  }

  public static perpendicDistFromLineSqrd(pt: IPoint64, line1: IPoint64, line2: IPoint64): number {
    const a = pt.x - line1.x;
    const b = pt.y - line1.y;
    const c = line2.x - line1.x;
    const d = line2.y - line1.y;
    if (c === 0 && d === 0) return 0;
    return Clipper.sqr(a * d - c * b) / (c * c + d * d);
  }

  static rdp(path: Path64, begin: number, end: number, epsSqrd: number, flags: boolean[]): void {
    let idx = 0;
    let max_d = 0;

    while (end > begin && path[begin] === path[end]) {
      flags[end--] = false;
    }
    for (let i = begin + 1; i < end; i++) {
      const d = Clipper.perpendicDistFromLineSqrd(path[i], path[begin], path[end]);
      if (d <= max_d) continue;
      max_d = d;
      idx = i;
    }

    if (max_d <= epsSqrd) return;

    flags[idx] = true;
    if (idx > begin + 1) rdp(path, begin, idx, epsSqrd, flags);
    if (idx < end - 1) rdp(path, idx, end, epsSqrd, flags);
  }

  public static ramerDouglasPeucker(path: Path64, epsilon: number): Path64 {
    const len = path.length;
    if (len < 5) return path;

    const flags = new Array<boolean>(len).fill(false);
    flags[0] = true;
    flags[len - 1] = true;
    rdp(path, 0, len - 1, sqr(epsilon), flags);

    const result: Path64 = [];
    for (let i = 0; i < len; i++) {
      if (flags[i]) result.push(path[i]);
    }
    return result;
  }

  public static ramerDouglasPeucker(paths: Paths64, epsilon: number): Paths64 {
    const result: Paths64 = [];
    for (const path of paths) {
      result.push(ramerDouglasPeucker(path, epsilon));
    }
    return result;
  }

  private static getNext(current: number, high: number, flags: boolean[]): number {
    current++;
    while (current <= high && flags[current]) current++;
    if (current <= high) return current;
    current = 0;
    while (flags[current]) current++;
    return current;
  }

  private static getPrior(current: number, high: number, flags: boolean[]): number {
    if (current === 0) current = high;
    else current--;
    while (current > 0 && flags[current]) current--;
    if (!flags[current]) return current;
    current = high;
    while (flags[current]) current--;
    return current;
  }

  private static sqr(value: number): number {
    return value * value;
  }

  public static simplifyPath(path: Path64, epsilon: number, isClosedPath: boolean = false): Path64 {
    const len = path.length;
    const high = len - 1;
    const epsSqr = this.sqr(epsilon);
    if (len < 4) return path;

    const flags: boolean[] = new Array<boolean>(len).fill(false);
    const dsq: number[] = new Array<number>(len).fill(0);
    let prev = high;
    let curr = 0;
    let start: number, next: number, prior2: number, next2: number;

    if (isClosedPath) {
      dsq[0] = this.perpendicDistFromLineSqrd(path[0], path[high], path[1]);
      dsq[high] = this.perpendicDistFromLineSqrd(path[high], path[0], path[high - 1]);
    } else {
      dsq[0] = Number.MAX_VALUE;
      dsq[high] = Number.MAX_VALUE;
    }

    for (let i = 1; i < high; i++) {
      dsq[i] = this.perpendicDistFromLineSqrd(path[i], path[i - 1], path[i + 1]);
    }

    for (; ;) {
      if (dsq[curr] > epsSqr) {
        start = curr;
        do {
          curr = this.getNext(curr, high, flags);
        } while (curr !== start && dsq[curr] > epsSqr);
        if (curr === start) break;
      }

      prev = this.getPrior(curr, high, flags);
      next = this.getNext(curr, high, flags);
      if (next === prev) break;

      if (dsq[next] < dsq[curr]) {
        flags[next] = true;
        next = this.getNext(next, high, flags);
        next2 = this.getNext(next, high, flags);
        dsq[curr] = this.perpendicDistFromLineSqrd(path[curr], path[prev], path[next]);
        if (next !== high || isClosedPath) {
          dsq[next] = this.perpendicDistFromLineSqrd(path[next], path[curr], path[next2]);
        }
        curr = next;
      } else {
        flags[curr] = true;
        curr = next;
        next = this.getNext(next, high, flags);
        prior2 = this.getPrior(prev, high, flags);
        dsq[curr] = this.perpendicDistFromLineSqrd(path[curr], path[prev], path[next]);
        if (prev !== 0 || isClosedPath) {
          dsq[prev] = this.perpendicDistFromLineSqrd(path[prev], path[prior2], path[curr]);
        }
      }
    }

    const result: Path64 = [];
    for (let i = 0; i < len; i++) {
      if (!flags[i]) result.push(path[i]);
    }
    return result;
  }

  public static simplifyPaths(paths: Paths64, epsilon: number, isClosedPaths: boolean = false): Paths64 {
    const result: Paths64 = [];
    for (const path of paths) {
      result.push(this.simplifyPath(path, epsilon, isClosedPaths));
    }
    return result;
  }

  //private static getNext(current: number, high: number, flags: boolean[]): number {
  //  current++;
  //  while (current <= high && flags[current]) current++;
  //  return current;
  //}

  //private static getPrior(current: number, high: number, flags: boolean[]): number {
  //  if (current === 0) return high;
  //  current--;
  //  while (current > 0 && flags[current]) current--;
  //  return current;
  //}


  public static trimCollinear(path: Path64, isOpen: boolean = false): Path64 {
    let len = path.length;
    let i = 0;

    if (!isOpen) {
      while (i < len - 1 && InternalClipper.crossProduct(path[len - 1], path[i], path[i + 1]) === 0) i++;
      while (i < len - 1 && InternalClipper.crossProduct(path[len - 2], path[len - 1], path[i]) === 0) len--;
    }

    if (len - i < 3) {
      if (!isOpen || len < 2 || path[0] === path[1]) {
        return [];
      }
      return path;
    }

    const result: Path64 = [];
    let last = path[i];
    result.push(last);

    for (i++; i < len - 1; i++) {
      if (InternalClipper.crossProduct(last, path[i], path[i + 1]) === 0) continue;
      last = path[i];
      result.push(last);
    }

    if (isOpen) {
      result.push(path[len - 1]);
    } else if (InternalClipper.crossProduct(last, path[len - 1], result[0]) !== 0) {
      result.push(path[len - 1]);
    } else {
      while (result.length > 2 && InternalClipper.crossProduct(result[result.length - 1], result[result.length - 2], result[0]) === 0) {
        result.pop();
      }
      if (result.length < 3) result.splice(0, result.length);
    }

    return result;
  }

  public static pointInPolygon(pt: Point64, polygon: Path64): PointInPolygonResult {
    return InternalClipper.pointInPolygon(pt, polygon);
  }

  public static ellipse(center: IPoint64, radiusX: number, radiusY: number = 0, steps: number = 0): Path64 {
    if (radiusX <= 0) return [];
    if (radiusY <= 0) radiusY = radiusX;
    if (steps <= 2) steps = Math.ceil(Math.PI * Math.sqrt((radiusX + radiusY) / 2));

    let si = Math.sin(2 * Math.PI / steps);
    let co = Math.cos(2 * Math.PI / steps);
    let dx = co, dy = si;
    let result: Path64 = [{ x: center.x + radiusX, y: center.y }];
    for (let i = 1; i < steps; ++i) {
      result.push({ x: center.x + radiusX * dx, y: center.y + radiusY * dy });
      let x = dx * co - dy * si;
      dy = dy * co + dx * si;
      dx = x;
    }
    return result;
  }

  private static showPolyPathStructure(pp: PolyPath64, level: number): void {
    let spaces = ' '.repeat(level * 2);
    let caption = pp.isHole ? "Hole " : "Outer ";
    if (pp.length === 0) {
      console.log(spaces + caption);
    } else {
      console.log(spaces + caption + `(${pp.length})`);
      pp.forEach(child => this.showPolyPathStructure(child, level + 1));
    }
  }

  public static showPolyTreeStructure(polytree: PolyTree64): void {
    console.log("Polytree Root");
    polytree.forEach(child => this.showPolyPathStructure(child, 1));
  }

}
