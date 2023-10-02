/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  24 September 2023                                               *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  Path Offset (Inflate/Shrink)                                    *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/

//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Core.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//

import { Clipper } from "./clipper";
import { ClipType, FillRule, IPoint64, InternalClipper, Path64, Paths64, Point64, Rect64 } from "./core";
import { Clipper64, PolyTree64 } from "./engine";

export enum JoinType {
  Miter,
  Square,
  Bevel,
  Round
}

export enum EndType {
  Polygon,
  Joined,
  Butt,
  Square,
  Round
}

class Group {
  inPaths: Paths64;
  outPath: Path64;
  outPaths: Paths64;
  joinType: JoinType;
  endType: EndType;
  pathsReversed: boolean;

  constructor(paths: Paths64, joinType: JoinType, endType: EndType = EndType.Polygon) {
    this.inPaths = [...paths]; // creates a shallow copy of paths
    this.joinType = joinType;
    this.endType = endType;
    this.outPath = [];
    this.outPaths = [];
    this.pathsReversed = false;
  }
}

export class PointD implements IPoint64 {
  public x: number;
  public y: number;

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

  public equals(obj: PointD): boolean {
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

export class ClipperOffset {

  private static Tolerance: number = 1.0E-12;
  private _groupList: Array<Group> = [];
  private _normals: Array<PointD> = [];
  private _solution: Paths64 = [];
  private _groupDelta!: number; //*0.5 for open paths; *-1.0 for negative areas
  private _delta!: number;
  private _mitLimSqr!: number;
  private _stepsPerRad!: number;
  private _stepSin!: number;
  private _stepCos!: number;
  private _joinType!: JoinType;
  private _endType!: EndType;
  public ArcTolerance: number;
  public MergeGroups: boolean;
  public MiterLimit: number;
  public PreserveCollinear: boolean;
  public ReverseSolution: boolean;

  public DeltaCallback?: (path: IPoint64[], path_norms: PointD[], currPt: number, prevPt: number) => number;

  constructor(miterLimit: number = 2.0, arcTolerance: number = 0.0,
    preserveCollinear: boolean = false, reverseSolution: boolean = false) {
    this.MiterLimit = miterLimit;
    this.ArcTolerance = arcTolerance;
    this.MergeGroups = true;
    this.PreserveCollinear = preserveCollinear;
    this.ReverseSolution = reverseSolution;
  }

  public clear(): void {
    this._groupList = [];
  }

  public addPath(path: Point64[], joinType: JoinType, endType: EndType): void {
    if (path.length === 0) return;
    const pp: Point64[][] = [path];
    this.addPaths(pp, joinType, endType);
  }

  public addPaths(paths: Paths64, joinType: JoinType, endType: EndType): void {
    if (paths.length === 0) return;
    this._groupList.push(new Group(paths, joinType, endType));
  }

  private executeInternal(delta: number): void {
    this._solution = [];
    if (this._groupList.length === 0) return;

    if (Math.abs(delta) < 0.5) {
      for (const group of this._groupList) {
        for (const path of group.inPaths) {
          this._solution.push(path);
        }
      }
    } else {
      this._delta = delta;
      this._mitLimSqr = (this.MiterLimit <= 1 ? 2.0 : 2.0 / this.sqr(this.MiterLimit));
      for (const group of this._groupList) {
        this.doGroupOffset(group);
      }
    }
  }

  private sqr(value: number): number {
    return value * value;
  }


  public execute(delta: number, solution: Paths64): void {
    solution.length = 0;
    this.executeInternal(delta);
    if (this._groupList.length === 0) return;

    // clean up self-intersections ...
    const c = new Clipper64()
    c.preserveCollinear = this.PreserveCollinear
    // the solution should retain the orientation of the input
    c.reverseSolution = this.ReverseSolution !== this._groupList[0].pathsReversed

    c.addSubjectPaths(this._solution);
    if (this._groupList[0].pathsReversed)
      c.execute(ClipType.Union, FillRule.Negative, solution);
    else
      c.execute(ClipType.Union, FillRule.Positive, solution);
  }

  public executePolytree(delta: number, polytree: PolyTree64): void {
    polytree.clear();
    this.executeInternal(delta);
    if (this._groupList.length === 0) return;

    // clean up self-intersections ...
    const c = new Clipper64()
    c.preserveCollinear = this.PreserveCollinear
    // the solution should retain the orientation of the input
    c.reverseSolution = this.ReverseSolution !== this._groupList[0].pathsReversed

    c.addSubjectPaths(this._solution);
    if (this._groupList[0].pathsReversed)
      c.executePolyTree(ClipType.Union, FillRule.Negative, polytree);
    else
      c.executePolyTree(ClipType.Union, FillRule.Positive, polytree);
  }

  protected static getUnitNormal(pt1: IPoint64, pt2: IPoint64): PointD {
    let dx = pt2.x - pt1.x;
    let dy = pt2.y - pt1.y;
    if (dx === 0 && dy === 0) return new PointD(0, 0);

    const f = 1.0 / Math.sqrt(dx * dx + dy * dy);
    dx *= f;
    dy *= f;

    return new PointD(dy, -dx);
  }

  public executeCallback(deltaCallback: (path: IPoint64[], path_norms: PointD[], currPt: number, prevPt: number) => number, solution: Point64[][]): void {
    this.DeltaCallback = deltaCallback;
    this.execute(1.0, solution);
  }

  private static getBoundsAndLowestPolyIdx(paths: Paths64): { index: number, rec: Rect64 } {
    const rec = new Rect64(false); // ie invalid rect
    let lpX: number = Number.MIN_SAFE_INTEGER;
    let index = -1;
    for (let i = 0; i < paths.length; i++) {
      for (const pt of paths[i]) {
        if (pt.y >= rec.bottom) {
          if (pt.y > rec.bottom || pt.x < lpX) {
            index = i;
            lpX = pt.x;
            rec.bottom = pt.y;
          }
        } else if (pt.y < rec.top) rec.top = pt.y;
        if (pt.x > rec.right) rec.right = pt.x;
        else if (pt.x < rec.left) rec.left = pt.x;
      }
    }
    return { index, rec }
  }

  private static translatePoint(pt: PointD, dx: number, dy: number): PointD {
    return new PointD(pt.x + dx, pt.y + dy);
  }

  private static reflectPoint(pt: PointD, pivot: PointD): PointD {
    return new PointD(pivot.x + (pivot.x - pt.x), pivot.y + (pivot.y - pt.y));
  }

  private static almostZero(value: number, epsilon: number = 0.001): boolean {
    return Math.abs(value) < epsilon;
  }

  private static hypotenuse(x: number, y: number): number {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
  }

  private static normalizeVector(vec: PointD): PointD {
    const h = this.hypotenuse(vec.x, vec.y);
    if (this.almostZero(h)) return new PointD(0, 0);
    const inverseHypot = 1 / h;
    return new PointD(vec.x * inverseHypot, vec.y * inverseHypot);
  }

  private static getAvgUnitVector(vec1: PointD, vec2: PointD): PointD {
    return this.normalizeVector(new PointD(vec1.x + vec2.x, vec1.y + vec2.y));
  }

  private static intersectPoint(pt1a: PointD, pt1b: PointD, pt2a: PointD, pt2b: PointD): PointD {
    if (InternalClipper.isAlmostZero(pt1a.x - pt1b.x)) { //vertical
      if (InternalClipper.isAlmostZero(pt2a.x - pt2b.x)) return new PointD(0, 0);
      const m2 = (pt2b.y - pt2a.y) / (pt2b.x - pt2a.x);
      const b2 = pt2a.y - m2 * pt2a.x;
      return new PointD(pt1a.x, m2 * pt1a.x + b2);
    }

    if (InternalClipper.isAlmostZero(pt2a.x - pt2b.x)) { //vertical
      const m1 = (pt1b.y - pt1a.y) / (pt1b.x - pt1a.x);
      const b1 = pt1a.y - m1 * pt1a.x;
      return new PointD(pt2a.x, m1 * pt2a.x + b1);
    } else {
      const m1 = (pt1b.y - pt1a.y) / (pt1b.x - pt1a.x);
      const b1 = pt1a.y - m1 * pt1a.x;
      const m2 = (pt2b.y - pt2a.y) / (pt2b.x - pt2a.x);
      const b2 = pt2a.y - m2 * pt2a.x;
      if (InternalClipper.isAlmostZero(m1 - m2)) return new PointD(0, 0);
      const x = (b2 - b1) / (m1 - m2);
      return new PointD(x, m1 * x + b1);
    }
  }

  private getPerpendic(pt: IPoint64, norm: PointD): Point64 {
    return new Point64(pt.x + norm.x * this._groupDelta, pt.y + norm.y * this._groupDelta);
  }

  private getPerpendicD(pt: IPoint64, norm: PointD): PointD {
    return new PointD(pt.x + norm.x * this._groupDelta, pt.y + norm.y * this._groupDelta);
  }

  private doBevel(group: Group, path: Path64, j: number, k: number) {
    let pt1: IPoint64, pt2: IPoint64
    if (j == k) {
      const absDelta = Math.abs(this._groupDelta);
      pt1 = new Point64(path[j].x - absDelta * this._normals[j].x, path[j].y - absDelta * this._normals[j].y);
      pt2 = new Point64(path[j].x + absDelta * this._normals[j].x, path[j].y + absDelta * this._normals[j].y);
    }
    else {
      pt1 = new Point64(path[j].x + this._groupDelta * this._normals[k].x, path[j].y + this._groupDelta * this._normals[k].y);
      pt2 = new Point64(path[j].x + this._groupDelta * this._normals[j].x, path[j].y + this._groupDelta * this._normals[j].y);
    }
    group.outPath.push(pt1);
    group.outPath.push(pt2);
  }

  private doSquare(group: Group, path: Path64, j: number, k: number): void {
    let vec: PointD;
    if (j === k) {
      vec = new PointD(this._normals[j].y, -this._normals[j].x);
    } else {
      vec = ClipperOffset.getAvgUnitVector(
        new PointD(-this._normals[k].y, this._normals[k].x),
        new PointD(this._normals[j].y, -this._normals[j].x)
      );
    }

    const absDelta = Math.abs(this._groupDelta);
    // now offset the original vertex delta units along unit vector
    let ptQ = new PointD(path[j].x, path[j].y);
    ptQ = ClipperOffset.translatePoint(ptQ, absDelta * vec.x, absDelta * vec.y);

    // get perpendicular vertices
    const pt1 = ClipperOffset.translatePoint(ptQ, this._groupDelta * vec.y, this._groupDelta * -vec.x);
    const pt2 = ClipperOffset.translatePoint(ptQ, this._groupDelta * -vec.y, this._groupDelta * vec.x);
    // get 2 vertices along one edge offset
    const pt3 = this.getPerpendicD(path[k], this._normals[k]);

    if (j === k) {
      const pt4 = new PointD(pt3.x + vec.x * this._groupDelta, pt3.y + vec.y * this._groupDelta);
      const pt = ClipperOffset.intersectPoint(pt1, pt2, pt3, pt4);
      //get the second intersect point through reflection
      group.outPath.push(new Point64(ClipperOffset.reflectPoint(pt, ptQ).x, ClipperOffset.reflectPoint(pt, ptQ).y));
      group.outPath.push(new Point64(pt.x, pt.y));
    } else {
      const pt4 = this.getPerpendicD(path[j], this._normals[k]);
      const pt = ClipperOffset.intersectPoint(pt1, pt2, pt3, pt4);
      group.outPath.push(new Point64(pt.x, pt.y));
      //get the second intersect point through reflection
      group.outPath.push(new Point64(ClipperOffset.reflectPoint(pt, ptQ).x, ClipperOffset.reflectPoint(pt, ptQ).y));
    }
  }

  private doMiter(group: Group, path: Path64, j: number, k: number, cosA: number): void {
    const q = this._groupDelta / (cosA + 1);
    group.outPath.push(new Point64(
      path[j].x + (this._normals[k].x + this._normals[j].x) * q,
      path[j].y + (this._normals[k].y + this._normals[j].y) * q
    ));
  }

  private doRound(group: Group, path: Path64, j: number, k: number, angle: number): void {
    if (typeof this.DeltaCallback !== "undefined") {
      const absDelta = Math.abs(this._groupDelta);
      const arcTol = this.ArcTolerance > 0.01
        ? this.ArcTolerance
        : Math.log10(2 + absDelta) * InternalClipper.defaultArcTolerance;
      const stepsPer360 = Math.PI / Math.acos(1 - arcTol / absDelta);
      this._stepSin = Math.sin((2 * Math.PI) / stepsPer360);
      this._stepCos = Math.cos((2 * Math.PI) / stepsPer360);
      if (this._groupDelta < 0.0) this._stepSin = -this._stepSin;
      this._stepsPerRad = stepsPer360 / (2 * Math.PI);
    }

    const pt = path[j];
    let offsetVec = new PointD(this._normals[k].x * this._groupDelta, this._normals[k].y * this._groupDelta);
    if (j === k) offsetVec.negate();
    group.outPath.push(new Point64(pt.x + offsetVec.x, pt.y + offsetVec.y));

    const steps = Math.ceil(this._stepsPerRad * Math.abs(angle));
    for (let i = 1; i < steps; i++) {
      offsetVec = new PointD(
        offsetVec.x * this._stepCos - this._stepSin * offsetVec.y,
        offsetVec.x * this._stepSin + offsetVec.y * this._stepCos
      );
      group.outPath.push(new Point64(pt.x + offsetVec.x, pt.y + offsetVec.y));
    }
    group.outPath.push(this.getPerpendic(pt, this._normals[j]));
  }

  private buildNormals(path: Path64): void {
    const cnt = path.length;
    this._normals = [];
    this._normals.length = cnt;

    for (let i = 0; i < cnt - 1; i++) {
      this._normals.push(ClipperOffset.getUnitNormal(path[i], path[i + 1]));
    }
    this._normals.push(ClipperOffset.getUnitNormal(path[cnt - 1], path[0]));
  }

  crossProduct(vec1: PointD, vec2: PointD): number {
    return (vec1.y * vec2.x - vec2.y * vec1.x);
  }

  dotProduct(vec1: PointD, vec2: PointD): number {
    return (vec1.x * vec2.x + vec1.y * vec2.y);
  }

  private offsetPoint(group: Group, path: Path64, j: number, k: number): void {
    const sinA = this.crossProduct(this._normals[j], this._normals[k]);
    let cosA = this.dotProduct(this._normals[j], this._normals[k]);
    if (sinA > 1.0) cosA = 1.0;
    else if (sinA < -1.0) cosA = -1.0;

    if (typeof this.DeltaCallback !== "undefined") {
      this._groupDelta = this.DeltaCallback(path, this._normals, j, k);
      if (group.pathsReversed) this._groupDelta = -this._groupDelta;
    }

    if (Math.abs(this._groupDelta) < ClipperOffset.Tolerance) {
      group.outPath.push(path[j]);
      return;
    }

    if (cosA > -0.99 && (sinA * this._groupDelta < 0)) { // test for concavity first (#593)
      // is concave
      group.outPath.push(this.getPerpendic(path[j], this._normals[k]));
      // this extra point is the only (simple) way to ensure that
      // path reversals are fully cleaned with the trailing clipper
      group.outPath.push(path[j]);
      group.outPath.push(this.getPerpendic(path[j], this._normals[j]));
    } else if (cosA > 0.999) {
      this.doMiter(group, path, j, k, cosA);
    } else if (this._joinType === JoinType.Miter) {
      // miter unless the angle is so acute the miter would exceeds ML
      if (cosA > this._mitLimSqr - 1) {
        this.doMiter(group, path, j, k, cosA);
      } else {
        this.doSquare(group, path, j, k);
      }
    } else if (cosA > 0.99 || this._joinType == JoinType.Bevel)
      //angle less than 8 degrees or a squared join
      this.doBevel(group, path, j, k);
    else if (this._joinType == JoinType.Round)
      this.doRound(group, path, j, k, Math.atan2(sinA, cosA));
    else
      this.doSquare(group, path, j, k);

    k = j;
  }

  private offsetPolygon(group: Group, path: Path64): void {
    const area = Clipper.area(path);
    if ((area < 0) !== (this._groupDelta < 0)) {
      const rect = Clipper.getBounds(path);
      const offsetMinDim = Math.abs(this._groupDelta) * 2;
      if (offsetMinDim > rect.width || offsetMinDim > rect.height) return;
    }

    group.outPath = [];
    const cnt = path.length;
    const prev = cnt - 1;
    for (let i = 0; i < cnt; i++) {
      this.offsetPoint(group, path, i, prev);
    }
    group.outPaths.push(group.outPath);
  }

  private offsetOpenJoined(group: Group, path: Path64): void {
    this.offsetPolygon(group, path);
    path = Clipper.reversePath(path);
    this.buildNormals(path);
    this.offsetPolygon(group, path);
  }

  private offsetOpenPath(group: Group, path: Path64): void {
    group.outPath = [];
    const highI = path.length - 1;

    if (typeof this.DeltaCallback !== "undefined") {
      this._groupDelta = this.DeltaCallback(path, this._normals, 0, 0);
    }

    if (Math.abs(this._groupDelta) < ClipperOffset.Tolerance) {
      group.outPath.push(path[0]);
    } else {
      switch (this._endType) {
        case EndType.Butt:
          this.doBevel(group, path, 0, 0);
          break;
        case EndType.Round:
          this.doRound(group, path, 0, 0, Math.PI);
          break;
        default:
          this.doSquare(group, path, 0, 0);
          break;
      }
    }

    for (let i = 1, k = 0; i < highI; i++) {
      this.offsetPoint(group, path, i, k);
    }

    for (let i = highI; i > 0; i--) {
      this._normals[i] = new PointD(-this._normals[i - 1].x, -this._normals[i - 1].y);
    }
    this._normals[0] = this._normals[highI];

    if (typeof this.DeltaCallback !== "undefined") {
      this._groupDelta = this.DeltaCallback(path, this._normals, highI, highI);
    }

    if (Math.abs(this._groupDelta) < ClipperOffset.Tolerance) {
      group.outPath.push(path[highI]);
    } else {
      switch (this._endType) {
        case EndType.Butt:
          this.doBevel(group, path, highI, highI);
          break;
        case EndType.Round:
          this.doRound(group, path, highI, highI, Math.PI);
          break;
        default:
          this.doSquare(group, path, highI, highI);
          break;
      }
    }

    for (let i = highI, k = 0; i > 0; i--) {
      this.offsetPoint(group, path, i, k);
    }

    group.outPaths.push(group.outPath);
  }

  private doGroupOffset(group: Group): void {
    if (group.endType == EndType.Polygon) {

      const { index } = ClipperOffset.getBoundsAndLowestPolyIdx(group.inPaths);

      if (index < 0) return;

      const area = Clipper.area(group.inPaths[index]);
      group.pathsReversed = area < 0;

      if (group.pathsReversed) {
        this._groupDelta = -this._delta;
      } else {
        this._groupDelta = this._delta;
      }
    } else {
      group.pathsReversed = false;
      this._groupDelta = Math.abs(this._delta) * 0.5;
    }

    const absDelta = Math.abs(this._groupDelta);
    this._joinType = group.joinType;
    this._endType = group.endType;

    if (!this.DeltaCallback &&
      (group.joinType == JoinType.Round || group.endType == EndType.Round)) {
      const arcTol = this.ArcTolerance > 0.01
        ? this.ArcTolerance
        : Math.log10(2 + absDelta) * InternalClipper.defaultArcTolerance;

      const stepsPer360 = Math.PI / Math.acos(1 - arcTol / absDelta);
      this._stepSin = Math.sin((2 * Math.PI) / stepsPer360);
      this._stepCos = Math.cos((2 * Math.PI) / stepsPer360);

      if (this._groupDelta < 0.0) {
        this._stepSin = -this._stepSin;
      }

      this._stepsPerRad = stepsPer360 / (2 * Math.PI);
    }

    const isJoined = group.endType == EndType.Joined || group.endType == EndType.Polygon;

    for (const p of group.inPaths) {
      const path = Clipper.stripDuplicates(p, isJoined);
      const cnt = path.length;

      if (cnt === 0 || (cnt < 3 && this._endType == EndType.Polygon)) {
        continue;
      }

      if (cnt == 1) {
        group.outPath = [];

        if (group.endType == EndType.Round) {
          const r = absDelta;
          const steps = Math.ceil(this._stepsPerRad * 2 * Math.PI);
          group.outPath = Clipper.ellipse(path[0], r, r, steps);
        } else {
          const d = Math.ceil(this._groupDelta);
          const r = new Rect64(path[0].x - d, path[0].y - d, path[0].x - d, path[0].y - d);
          group.outPath = r.asPath();
        }

        group.outPaths.push(group.outPath);
      } else {
        if (cnt == 2 && group.endType == EndType.Joined) {
          if (group.joinType == JoinType.Round) {
            this._endType = EndType.Round;
          } else {
            this._endType = EndType.Square;
          }
        }

        this.buildNormals(path);

        if (this._endType == EndType.Polygon) {
          this.offsetPolygon(group, path);
        } else if (this._endType == EndType.Joined) {
          this.offsetOpenJoined(group, path);
        } else {
          this.offsetOpenPath(group, path);
        }
      }
    }

    this._solution.push(...group.outPaths);
    group.outPaths = [];
  }
}
