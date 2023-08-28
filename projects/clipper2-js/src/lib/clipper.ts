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
// ChatGTP has few points to note:
//

import { ClipType, FillRule, InternalClipper, Path64, PathD, PathType, Paths64, PathsD, Point64, PointD, Rect64, RectD } from "./core";
import { Clipper64, ClipperD, PointInPolygonResult, PolyPath64, PolyPathD, PolyTree64, PolyTreeD } from "./engine";

export class Clipper {

  private static invalidRect64: Rect64 = new Rect64(false);
  public static get InvalidRect64(): Rect64 {
    return this.invalidRect64;
  }

  private static invalidRectD: RectD = new RectD(false);
  public static get InvalidRectD(): RectD {
    return this.invalidRectD;
  }

  public static Intersect(subject: Paths64, clip: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Intersection, subject, clip, fillRule);
  }

  public static Intersect(subject: PathsD, clip: PathsD, fillRule: FillRule, precision: number = 2): PathsD {
    return this.BooleanOp(ClipType.Intersection, subject, clip, fillRule, precision);
  }

  public static Union(subject: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Union, subject, null, fillRule);
  }

  public static Union(subject: Paths64, clip: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Union, subject, clip, fillRule);
  }

  public static Union(subject: PathsD, fillRule: FillRule): PathsD {
    return this.BooleanOp(ClipType.Union, subject, null, fillRule);
  }

  public static Union(subject: PathsD, clip: PathsD, fillRule: FillRule, precision: number = 2): PathsD {
    return this.BooleanOp(ClipType.Union, subject, clip, fillRule, precision);
  }

  public static Difference(subject: Paths64, clip: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Difference, subject, clip, fillRule);
  }

  public static Difference(subject: PathsD, clip: PathsD, fillRule: FillRule, precision: number = 2): PathsD {
    return this.BooleanOp(ClipType.Difference, subject, clip, fillRule, precision);
  }

  public static Xor(subject: Paths64, clip: Paths64, fillRule: FillRule): Paths64 {
    return this.BooleanOp(ClipType.Xor, subject, clip, fillRule);
  }

  public static Xor(subject: PathsD, clip: PathsD, fillRule: FillRule, precision: number = 2): PathsD {
    return this.BooleanOp(ClipType.Xor, subject, clip, fillRule, precision);
  }

  public static BooleanOp(clipType: ClipType, subject?: Paths64, clip?: Paths64, fillRule: FillRule): Paths64 {
    const solution: Paths64 = new Paths64();
    if (!subject) return solution;
    const c: Clipper64 = new Clipper64();
    c.AddPaths(subject, PathType.Subject);
    if (clip)
      c.AddPaths(clip, PathType.Clip);
    c.Execute(clipType, fillRule, solution);
    return solution;
  }

  public static BooleanOp(clipType: ClipType, subject: Paths64, clip: Paths64, polytree: PolyTree64, fillRule: FillRule): void {
    if (!subject) return;
    const c: Clipper64 = new Clipper64();
    c.AddPaths(subject, PathType.Subject);
    if (clip)
      c.AddPaths(clip, PathType.Clip);
    c.Execute(clipType, fillRule, polytree);
  }

  public static BooleanOp(clipType: ClipType, subject: PathsD, clip: PathsD, fillRule: FillRule, precision: number = 2): PathsD {
    const solution: PathsD = new PathsD();
    const c: ClipperD = new ClipperD(precision);
    c.AddSubject(subject);
    if (clip)
      c.AddClip(clip);
    c.Execute(clipType, fillRule, solution);
    return solution;
  }

  public static BooleanOp(clipType: ClipType, subject: PathsD, clip: PathsD, polytree: PolyTreeD, fillRule: FillRule, precision: number = 2): void {
    if (!subject) return;
    const c: ClipperD = new ClipperD(precision);
    c.AddPaths(subject, PathType.Subject);
    if (clip)
      c.AddPaths(clip, PathType.Clip);
    c.Execute(clipType, fillRule, polytree);
  }

  public static InflatePaths(paths: Paths64, delta: number, joinType: JoinType, endType: EndType, miterLimit: number = 2.0): Paths64 {
    const co: ClipperOffset = new ClipperOffset(miterLimit);
    co.AddPaths(paths, joinType, endType);
    const solution: Paths64 = new Paths64();
    co.Execute(delta, solution);
    return solution;
  }

  public static InflatePaths(paths: PathsD, delta: number, joinType: JoinType, endType: EndType, miterLimit: number = 2.0, precision: number = 2): PathsD {
    InternalClipper.CheckPrecision(precision);
    const scale: number = Math.pow(10, precision);
    const tmp: Paths64 = this.ScalePaths64(paths, scale);
    const co: ClipperOffset = new ClipperOffset(miterLimit);
    co.AddPaths(tmp, joinType, endType);
    co.Execute(delta * scale, tmp); // reuse 'tmp' to receive (scaled) solution
    return this.ScalePathsD(tmp, 1 / scale);
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

  public static RectClip(rect: RectD, paths: PathsD, precision: number = 2): PathsD {
    InternalClipper.checkPrecision(precision);
    if (rect.isEmpty() || paths.length === 0) return new PathsD();
    const scale: number = Math.pow(10, precision);
    const r: Rect64 = this.scaleRect(rect, scale);
    let tmpPath: Paths64 = this.scalePaths64(paths, scale);
    const rc = new RectClip64(r);
    tmpPath = rc.execute(tmpPath);
    return this.scalePathsD(tmpPath, 1 / scale);
  }

  public static RectClip(rect: RectD, path: PathD, precision: number = 2): PathsD {
    if (rect.isEmpty() || path.length === 0) return new PathsD();
    const tmp: PathsD = new PathsD();
    tmp.push(path);
    return this.RectClip(rect, tmp, precision);
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

  public static RectClipLines(rect: RectD, paths: PathsD, precision: number = 2): PathsD {
    InternalClipper.checkPrecision(precision);
    if (rect.isEmpty() || paths.length === 0) return new PathsD();
    const scale: number = Math.pow(10, precision);
    const r: Rect64 = this.scaleRect(rect, scale);
    let tmpPath: Paths64 = this.scalePaths64(paths, scale);
    const rc = new RectClipLines64(r);
    tmpPath = rc.execute(tmpPath);
    return this.scalePathsD(tmpPath, 1 / scale);
  }

  public static RectClipLines(rect: RectD, path: PathD, precision: number = 2): PathsD {
    if (rect.isEmpty() || path.length === 0) return new PathsD();
    const tmp: PathsD = new PathsD();
    tmp.push(path);
    return this.RectClipLines(rect, tmp, precision);
  }

  public static MinkowskiSum(pattern: Path64, path: Path64, isClosed: boolean): Paths64 {
    return Minkowski.sum(pattern, path, isClosed);
  }

  public static MinkowskiSum(pattern: PathD, path: PathD, isClosed: boolean): PathsD {
    return Minkowski.sum(pattern, path, isClosed);
  }

  public static MinkowskiDiff(pattern: Path64, path: Path64, isClosed: boolean): Paths64 {
    return Minkowski.diff(pattern, path, isClosed);
  }

  public static MinkowskiDiff(pattern: PathD, path: PathD, isClosed: boolean): PathsD {
    return Minkowski.diff(pattern, path, isClosed);
  }

  public static area(path: Path64): number {
    // https://en.wikipedia.org/wiki/Shoelace_formula
    let a = 0.0;
    const cnt = path.length;
    if (cnt < 3) return 0.0;
    let prevPt = path[cnt - 1];
    for (let pt of path) {
      a += (prevPt.Y + pt.Y) * (prevPt.X - pt.X);
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

  public static area(path: PathD): number {
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

  public static area(paths: PathsD): number {
    let a = 0.0;
    for (let path of paths)
      a += this.area(path);
    return a;
  }

  public static isPositive(poly: Path64): boolean {
    return this.area(poly) >= 0;
  }

  public static isPositive(poly: PathD): boolean {
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

  public static pathDToString(path: PathD): string {
    let result = "";
    for (let pt of path)
      result += pt.toString();
    return result + '\n';
  }

  public static pathsDToString(paths: PathsD): string {
    let result = "";
    for (let path of paths)
      result += this.pathDToString(path);
    return result;
  }

  public static offsetPath(path: Path64, dx: number, dy: number): Path64 {
    const result = new Path64(path.length);
    for (let pt of path)
      result.push(new Point64(pt.X + dx, pt.Y + dy));
    return result;
  }

  public static scalePoint64(pt: Point64, scale: number): Point64 {
    const result: Point64 = {
      X: Math.round(pt.X * scale),
      Y: Math.round(pt.Y * scale)
    };
    return result;
  }

  public static scalePointD(pt: Point64, scale: number): PointD {
    const result: PointD = {
      x: pt.X * scale,
      y: pt.Y * scale
    };
    return result;
  }

  public static scaleRect(rec: RectD, scale: number): Rect64 {
    const result: Rect64 = {
      left: Math.round(rec.left * scale),
      top: Math.round(rec.top * scale),
      right: Math.round(rec.right * scale),
      bottom: Math.round(rec.bottom * scale)
    };
    return result;
  }

  public static scalePath(path: Path64, scale: number): Path64 {
    if (InternalClipper.isAlmostZero(scale - 1)) return path;
    const result: Path64 = [];
    for (const pt of path)
      result.push({ X: pt.X * scale, Y: pt.Y * scale });
    return result;
  }

  public static scalePaths(paths: Paths64, scale: number): Paths64 {
    if (InternalClipper.isAlmostZero(scale - 1)) return paths;
    const result: Paths64 = [];
    for (const path of paths)
      result.push(this.scalePath(path, scale));
    return result;
  }

  public static scalePath(path: PathD, scale: number): PathD {
    if (InternalClipper.isAlmostZero(scale - 1)) return path;
    const result: PathD = [];
    for (const pt of path)
      result.push({ x: pt.x * scale, y: pt.y * scale });
    return result;
  }

  public static scalePaths(paths: PathsD, scale: number): PathsD {
    if (InternalClipper.isAlmostZero(scale - 1)) return paths;
    const result: PathsD = [];
    for (const path of paths)
      result.push(this.scalePath(path, scale));
    return result;
  }

  // Unlike scalePath, both scalePath64 & scalePathD also involve type conversion
  public static scalePath64(path: PathD, scale: number): Path64 {
    const res: Path64 = [];
    for (const pt of path)
      res.push({ X: Math.round(pt.x * scale), Y: Math.round(pt.y * scale) });
    return res;
  }

  public static scalePaths64(paths: PathsD, scale: number): Paths64 {
    const res: Paths64 = [];
    for (const path of paths)
      res.push(this.scalePath64(path, scale));
    return res;
  }

  public static scalePathD(path: Path64, scale: number): PathD {
    const res: PathD = [];
    for (const pt of path)
      res.push({ x: pt.X * scale, y: pt.Y * scale });
    return res;
  }

  public static scalePathsD(paths: Paths64, scale: number): PathsD {
    const res: PathsD = [];
    for (const path of paths)
      res.push(this.scalePathD(path, scale));
    return res;
  }

  public static path64(path: PathD): Path64 {
    const result: Path64 = [];
    for (const pt of path) {
      result.push({ X: pt.x, Y: pt.y });
    }
    return result;
  }

  public static paths64(paths: PathsD): Paths64 {
    const result: Paths64 = [];
    for (const path of paths) {
      result.push(this.path64(path));
    }
    return result;
  }

  public static pathsD(paths: Paths64): PathsD {
    const result: PathsD = [];
    for (const path of paths) {
      result.push(this.pathD(path));
    }
    return result;
  }

  public static pathD(path: Path64): PathD {
    const result: PathD = [];
    for (const pt of path) {
      result.push({ x: pt.X, y: pt.Y });
    }
    return result;
  }

  public static translatePath(path: Path64, dx: number, dy: number): Path64 {
    const result: Path64 = [];
    for (const pt of path) {
      result.push({ X: pt.X + dx, Y: pt.Y + dy });
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

  public static translatePath(path: PathD, dx: number, dy: number): PathD {
    const result: PathD = [];
    for (const pt of path) {
      result.push({ x: pt.x + dx, y: pt.y + dy });
    }
    return result;
  }

  public static translatePaths(paths: PathsD, dx: number, dy: number): PathsD {
    const result: PathsD = [];
    for (const path of paths) {
      result.push(this.translatePath(path, dx, dy));
    }
    return result;
  }

  public static reversePath(path: Path64): Path64 {
    return [...path].reverse();
  }

  public static reversePath(path: PathD): PathD {
    return [...path].reverse();
  }

  public static reversePaths(paths: Paths64): Paths64 {
    const result: Paths64 = [];
    for (const t of paths) {
      result.push(this.reversePath(t));
    }
    return result;
  }

  public static reversePaths(paths: PathsD): PathsD {
    const result: PathsD = [];
    for (const path of paths) {
      result.push(this.reversePath(path));
    }
    return result;
  }

  public static getBounds(path: Path64): Rect64 {
    const result: Rect64 = InvalidRect64;
    for (const pt of path) {
      if (pt.X < result.left) result.left = pt.X;
      if (pt.X > result.right) result.right = pt.X;
      if (pt.Y < result.top) result.top = pt.Y;
      if (pt.Y > result.bottom) result.bottom = pt.Y;
    }
    return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, right: 0, top: 0, bottom: 0 } : result;
  }

  public static getBounds(paths: Paths64): Rect64 {
    const result: Rect64 = InvalidRect64;
    for (const path of paths) {
      for (const pt of path) {
        if (pt.X < result.left) result.left = pt.X;
        if (pt.X > result.right) result.right = pt.X;
        if (pt.Y < result.top) result.top = pt.Y;
        if (pt.Y > result.bottom) result.bottom = pt.Y;
      }
    }
    return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, right: 0, top: 0, bottom: 0 } : result;
  }

  public static getBounds(path: PathD): RectD {
    const result: RectD = InvalidRectD;
    for (const pt of path) {
      if (pt.x < result.left) result.left = pt.x;
      if (pt.x > result.right) result.right = pt.x;
      if (pt.y < result.top) result.top = pt.y;
      if (pt.y > result.bottom) result.bottom = pt.y;
    }
    return result.left === Number.MAX_VALUE ? { left: 0, right: 0, top: 0, bottom: 0 } : result;
  }

  static getBounds(paths: PathsD): RectD {
    let result: RectD = InvalidRectD;
    for (let path of paths)
      for (let pt of path) {
        if (pt.x < result.left) result.left = pt.x;
        if (pt.x > result.right) result.right = pt.x;
        if (pt.y < result.top) result.top = pt.y;
        if (pt.y > result.bottom) result.bottom = pt.y;
      }
    return result.left === Number.MAX_VALUE ? new RectD() : result;
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

  static makePath(arr: number[]): PathD {
    let len = arr.length / 2;
    let p = new PathD(len);
    for (let i = 0; i < len; i++)
      p.push(new PointD(arr[i * 2], arr[i * 2 + 1]));
    return p;
  }

  static sqr(value: number): number {
    return value * value;
  }

  static pointsNearEqual(pt1: PointD, pt2: PointD, distanceSqrd: number): boolean {
    return this.sqr(pt1.x - pt2.x) + this.sqr(pt1.y - pt2.y) < distanceSqrd;
  }

  static stripNearDuplicates(path: PathD, minEdgeLenSqrd: number, isClosedPath: boolean): PathD {
    let cnt = path.length;
    let result = new PathD(cnt);
    if (cnt === 0) return result;
    let lastPt = path[0];
    result.push(lastPt);
    for (let i = 1; i < cnt; i++)
      if (!this.pointsNearEqual(lastPt, path[i], minEdgeLenSqrd)) {
        lastPt = path[i];
        result.push(lastPt);
      }

    if (isClosedPath && this.pointsNearEqual(lastPt, result[0], minEdgeLenSqrd))
      result.pop();

    return result;
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

  public static addPolyNodeToPathsD(polyPath: PolyPathD, paths: PathsD): void {
    if (polyPath.polygon && polyPath.polygon.length > 0) {
      paths.push(polyPath.polygon);
    }
    for (let i = 0; i < polyPath.count; i++) {
      addPolyNodeToPathsD(polyPath._childs[i] as PolyPathD, paths);
    }
  }

  public static polyTreeToPathsD(polyTree: PolyTreeD): PathsD {
    const result: PathsD = new PathsD();
    for (const polyPathBase of polyTree) {
      const p = polyPathBase as PolyPathD;
      addPolyNodeToPathsD(p, result);
    }

    return result;
  }

  public static perpendicDistFromLineSqrd(pt: PointD, line1: PointD, line2: PointD): number {
    const a = pt.x - line1.x;
    const b = pt.y - line1.y;
    const c = line2.x - line1.x;
    const d = line2.y - line1.y;
    if (c === 0 && d === 0) return 0;
    return sqr(a * d - c * b) / (c * c + d * d);
  }

  public static perpendicDistFromLineSqrd(pt: Point64, line1: Point64, line2: Point64): number {
    const a = pt.x - line1.x;
    const b = pt.y - line1.y;
    const c = line2.x - line1.x;
    const d = line2.y - line1.y;
    if (c === 0 && d === 0) return 0;
    return sqr(a * d - c * b) / (c * c + d * d);
  }

  static rdp(path: Path64, begin: number, end: number, epsSqrd: number, flags: boolean[]): void {
    let idx = 0;
    let max_d = 0;

    while (end > begin && path[begin] === path[end]) {
      flags[end--] = false;
    }
    for (let i = begin + 1; i < end; i++) {
      const d = perpendicDistFromLineSqrd(path[i], path[begin], path[end]);
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

  static rdp(path: PathD, begin: number, end: number, epsSqrd: number, flags: boolean[]): void {
    let idx = 0;
    let max_d = 0;

    while (end > begin && path[begin] === path[end]) {
      flags[end--] = false;
    }
    for (let i = begin + 1; i < end; i++) {
      const d = perpendicDistFromLineSqrd(path[i], path[begin], path[end]);
      if (d <= max_d) continue;
      max_d = d;
      idx = i;
    }

    if (max_d <= epsSqrd) return;

    flags[idx] = true;
    if (idx > begin + 1) rdp(path, begin, idx, epsSqrd, flags);
    if (idx < end - 1) rdp(path, idx, end, epsSqrd, flags);
  }

  public static ramerDouglasPeucker(path: PathD, epsilon: number): PathD {
    const len = path.length;
    if (len < 5) return path;
    const flags: boolean[] = new Array<boolean>(len).fill(false);
    flags[0] = true;
    flags[len - 1] = true;
    this.RDP(path, 0, len - 1, this.sqr(epsilon), flags);
    const result: PathD = new Array(len);
    for (let i = 0; i < len; i++) {
      if (flags[i]) result.push(path[i]);
    }
    return result;
  }

  public static ramerDouglasPeuckerForPaths(paths: PathsD, epsilon: number): PathsD {
    const result: PathsD = new Array(paths.length);
    for (const path of paths) {
      result.push(this.ramerDouglasPeucker(path, epsilon));
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

  private static getNext(current: number, high: number, flags: boolean[]): number {
    current++;
    while (current <= high && flags[current]) current++;
    return current;
  }

  private static getPrior(current: number, high: number, flags: boolean[]): number {
    if (current === 0) return high;
    current--;
    while (current > 0 && flags[current]) current--;
    return current;
  }

  public static simplifyPath(path: PathD, epsilon: number, isOpenPath: boolean = false): PathD {
    const len = path.length;
    const high = len - 1;
    const epsSqr = this.sqr(epsilon);
    if (len < 4) return path;

    const flags: boolean[] = new Array<boolean>(len).fill(false);
    const dsq: number[] = new Array<number>(len).fill(0);
    let prev = high;
    let curr = 0;
    let start: number, next: number, prior2: number, next2: number;

    if (isOpenPath) {
      dsq[0] = Number.MAX_VALUE;
      dsq[high] = Number.MAX_VALUE;
    } else {
      dsq[0] = this.perpendicDistFromLineSqrd(path[0], path[high], path[1]);
      dsq[high] = this.perpendicDistFromLineSqrd(path[high], path[0], path[high - 1]);
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
        if (next !== high || !isOpenPath) {
          dsq[next] = this.perpendicDistFromLineSqrd(path[next], path[curr], path[next2]);
        }
        curr = next;
      } else {
        flags[curr] = true;
        curr = next;
        next = this.getNext(next, high, flags);
        prior2 = this.getPrior(prev, high, flags);
        dsq[curr] = this.perpendicDistFromLineSqrd(path[curr], path[prev], path[next]);
        if (prev !== 0 || !isOpenPath) {
          dsq[prev] = this.perpendicDistFromLineSqrd(path[prev], path[prior2], path[curr]);
        }
      }
    }

    const result: PathD = [];
    for (let i = 0; i < len; i++) {
      if (!flags[i]) result.push(path[i]);
    }
    return result;
  }

  public static simplifyPaths(paths: PathsD, epsilon: number, isOpenPath: boolean = false): PathsD {
    const result: PathsD = [];
    for (const path of paths) {
      result.push(this.simplifyPath(path, epsilon, isOpenPath));
    }
    return result;
  }

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

  public static trimCollinear(path: PathD, precision: number, isOpen: boolean = false): PathD {
    InternalClipper.checkPrecision(precision);
    const scale = Math.pow(10, precision);
    let p = this.scalePath64(path, scale);
    p = this.trimCollinear(p, isOpen);
    return this.scalePathD(p, 1 / scale);
  }

  public static pointInPolygon(pt: Point64, polygon: Path64): PointInPolygonResult {
    return InternalClipper.pointInPolygon(pt, polygon);
  }

  public static pointInPolygonD(pt: PointD, polygon: PathD, precision: number = 2): PointInPolygonResult {
    InternalClipper.checkPrecision(precision);
    const scale = Math.pow(10, precision);
    const p = new Point64(pt, scale);
    const path = this.scalePath64(polygon, scale);
    return InternalClipper.pointInPolygon(p, path);
  }

  public static ellipse(center: Point64, radiusX: number, radiusY: number = 0, steps: number = 0): Path64 {
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

  public static ellipseD(center: PointD, radiusX: number, radiusY: number = 0, steps: number = 0): PathD {
    if (radiusX <= 0) return [];
    if (radiusY <= 0) radiusY = radiusX;
    if (steps <= 2) steps = Math.ceil(Math.PI * Math.sqrt((radiusX + radiusY) / 2));

    let si = Math.sin(2 * Math.PI / steps);
    let co = Math.cos(2 * Math.PI / steps);
    let dx = co, dy = si;
    let result: PathD = [{ x: center.x + radiusX, y: center.y }];
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

  private static showPolyPathStructureD(pp: PolyPathD, level: number): void {
    let spaces = ' '.repeat(level * 2);
    let caption = pp.isHole ? "Hole " : "Outer ";
    if (pp.length === 0) {
      console.log(spaces + caption);
    } else {
      console.log(spaces + caption + `(${pp.length})`);
      pp.forEach(child => this.showPolyPathStructureD(child, level + 1));
    }
  }

  public static showPolyTreeStructureD(polytree: PolyTreeD): void {
    console.log("Polytree Root");
    polytree.forEach(child => this.showPolyPathStructureD(child, 1));
  }
}
