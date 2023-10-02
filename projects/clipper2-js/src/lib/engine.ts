/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  3 September 2023                                                  *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  This is the main polygon clipping module                        *
* Thanks    :  Special thanks to Thong Nguyen, Guus Kuiper, Phil Stopford,     *
*           :  and Daniel Gosnell for their invaluable assistance with C#.     *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/

import { Clipper } from "./clipper";
import { ClipType, FillRule, IPoint64, InternalClipper, MidpointRounding, Path64, PathType, Paths64, Point64, Rect64, midPointRound } from "./core";

//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Engine.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//

export enum PointInPolygonResult {
  IsOn = 0,
  IsInside = 1,
  IsOutside = 2
}

export enum VertexFlags {
  None = 0,
  OpenStart = 1,
  OpenEnd = 2,
  LocalMax = 4,
  LocalMin = 8
}

class Vertex {
  readonly pt: IPoint64;
  next: Vertex | undefined;
  prev: Vertex | undefined;
  flags: VertexFlags;

  constructor(pt: IPoint64, flags: VertexFlags, prev: Vertex | undefined) {
    this.pt = pt;
    this.flags = flags;
    this.next = undefined;
    this.prev = prev;
  }
}


class LocalMinima {
  readonly vertex: Vertex;
  readonly polytype: PathType;
  readonly isOpen: boolean;

  constructor(vertex: Vertex, polytype: PathType, isOpen: boolean = false) {
    this.vertex = vertex;
    this.polytype = polytype;
    this.isOpen = isOpen;
  }

  static equals(lm1: LocalMinima, lm2: LocalMinima): boolean {
    return lm1.vertex === lm2.vertex;
  }

  static notEquals(lm1: LocalMinima, lm2: LocalMinima): boolean {
    return lm1.vertex !== lm2.vertex;
  }

  //hashCode(): number {
  //  return this.vertex.hashCode();
  //}
}

class IntersectNode {
  readonly pt: IPoint64;
  readonly edge1: Active;
  readonly edge2: Active;

  constructor(pt: IPoint64, edge1: Active, edge2: Active) {
    this.pt = pt;
    this.edge1 = edge1;
    this.edge2 = edge2;
  }
}

class OutPt {
  pt: IPoint64;
  next: OutPt | undefined;
  prev: OutPt;
  outrec: OutRec;
  horz: HorzSegment | undefined;

  constructor(pt: IPoint64, outrec: OutRec) {
    this.pt = pt;
    this.outrec = outrec;
    this.next = this;
    this.prev = this;
    this.horz = undefined;
  }
}

export enum JoinWith {
  None,
  Left,
  Right
}

export enum HorzPosition {
  Bottom,
  Middle,
  Top
}


export class OutRec {
  idx: number;
  owner: OutRec | undefined;
  frontEdge: Active | undefined;
  backEdge: Active | undefined;
  pts: OutPt | undefined;
  polypath: PolyPathBase | undefined;
  bounds!: Rect64;
  path!: Path64;
  isOpen: boolean;
  splits: number[] | undefined;
  recursiveSplit: OutRec | undefined;
  constructor(idx: number) {
    this.idx = idx
    this.isOpen = false
  }
}

class HorzSegment {
  leftOp: OutPt //| undefined;
  rightOp: OutPt | undefined;
  leftToRight: boolean;

  constructor(op: OutPt) {
    this.leftOp = op;
    this.rightOp = undefined;
    this.leftToRight = true;
  }
}

class HorzJoin {
  op1: OutPt | undefined;
  op2: OutPt | undefined;

  constructor(ltor: OutPt, rtol: OutPt) {
    this.op1 = ltor;
    this.op2 = rtol;
  }
}

///////////////////////////////////////////////////////////////////
// Important: UP and DOWN here are premised on Y-axis positive down
// displays, which is the orientation used in Clipper's development.
///////////////////////////////////////////////////////////////////

export class Active {
  bot!: IPoint64
  top!: IPoint64
  curX!: number;// current (updated at every new scanline)
  dx: number;
  windDx!: number;// 1 or -1 depending on winding direction
  windCount: number;
  windCount2: number;// winding count of the opposite polytype
  outrec: OutRec | undefined;

  // AEL: 'active edge list' (Vatti's AET - active edge table)
  //     a linked list of all edges (from left to right) that are present
  //     (or 'active') within the current scanbeam (a horizontal 'beam' that
  //     sweeps from bottom to top over the paths in the clipping operation).
  prevInAEL: Active | undefined;
  nextInAEL: Active | undefined;

  // SEL: 'sorted edge list' (Vatti's ST - sorted table)
  //     linked list used when sorting edges into their new positions at the
  //     top of scanbeams, but also (re)used to process horizontals.
  prevInSEL: Active | undefined;
  nextInSEL: Active | undefined;
  jump: Active | undefined;
  vertexTop: Vertex | undefined
  localMin!: LocalMinima // the bottom of an edge 'bound' (also Vatti)
  isLeftBound: boolean
  joinWith: JoinWith

  constructor() {
    this.dx = this.windCount = this.windCount2 = 0
    this.isLeftBound = false
    this.joinWith = JoinWith.None
  }
}

export class ClipperEngine {
  static addLocMin(vert: Vertex, polytype: PathType, isOpen: boolean, minimaList: LocalMinima[]): void {
    // make sure the vertex is added only once ...
    if ((vert.flags & VertexFlags.LocalMin) !== VertexFlags.None) return;
    vert.flags |= VertexFlags.LocalMin;

    const lm = new LocalMinima(vert, polytype, isOpen);
    minimaList.push(lm);
  }

  static addPathsToVertexList(paths: Path64[], polytype: PathType, isOpen: boolean, minimaList: LocalMinima[], vertexList: Vertex[]): void {
    let totalVertCnt = 0;
    for (const path of paths)
      totalVertCnt += path.length;

    for (const path of paths) {
      let v0: Vertex | undefined = undefined;
      let prev_v: Vertex | undefined = undefined;
      let curr_v: Vertex | undefined = undefined;
      for (const pt of path) {
        if (!v0) {
          v0 = new Vertex(pt, VertexFlags.None, undefined);
          vertexList.push(v0);
          prev_v = v0;
        } else if (prev_v!.pt !== pt) {  // i.e., skips duplicates
          curr_v = new Vertex(pt, VertexFlags.None, prev_v);
          vertexList.push(curr_v);
          prev_v!.next = curr_v;
          prev_v = curr_v;
        }
      }
      if (!prev_v || !prev_v.prev) continue;
      if (!isOpen && prev_v.pt === v0!.pt) prev_v = prev_v.prev;
      prev_v.next = v0;
      v0!.prev = prev_v;
      if (!isOpen && prev_v.next === prev_v) continue;

      // OK, we have a valid path
      let going_up = false

      if (isOpen) {
        curr_v = v0!.next;
        let count = 0
        while (curr_v !== v0 && curr_v!.pt.y === v0!.pt.y) {
          curr_v = curr_v!.next;
          if (count++ > totalVertCnt) {
            console.warn('infinite loop detected')
            break;
          }
        }
        going_up = curr_v!.pt.y <= v0!.pt.y;
        if (going_up) {
          v0!.flags = VertexFlags.OpenStart;
          this.addLocMin(v0!, polytype, true, minimaList);
        } else {
          v0!.flags = VertexFlags.OpenStart | VertexFlags.LocalMax;
        }
      } else { // closed path
        prev_v = v0!.prev;
        let count = 0
        while (prev_v !== v0 && prev_v!.pt.y === v0!.pt.y) {
          prev_v = prev_v!.prev;

          if (count++ > totalVertCnt) {
            console.warn('infinite loop detected')
            break;
          }
        }
        if (prev_v === v0) {
          continue; // only open paths can be completely flat
        }
        going_up = prev_v!.pt.y > v0!.pt.y;
      }

      const going_up0 = going_up;
      prev_v = v0;
      curr_v = v0!.next;

      let count = 0
      while (curr_v !== v0) {
        if (curr_v!.pt.y > prev_v!.pt.y && going_up) {
          prev_v!.flags |= VertexFlags.LocalMax;
          going_up = false;
        } else if (curr_v!.pt.y < prev_v!.pt.y && !going_up) {
          going_up = true;
          this.addLocMin(prev_v!, polytype, isOpen, minimaList);
        }
        prev_v = curr_v;
        curr_v = curr_v!.next;

        if (count++ > totalVertCnt) {
          console.warn('infinite loop detected')
          break;
        }

      }

      if (isOpen) {
        prev_v!.flags |= VertexFlags.OpenEnd;
        if (going_up) {
          prev_v!.flags |= VertexFlags.LocalMax;
        } else {
          this.addLocMin(prev_v!, polytype, isOpen, minimaList);
        }
      } else if (going_up !== going_up0) {
        if (going_up0) {
          this.addLocMin(prev_v!, polytype, false, minimaList);
        } else {
          prev_v!.flags |= VertexFlags.LocalMax;
        }
      }
    }
  }
}

export class ReuseableDataContainer64 {
  readonly _minimaList: LocalMinima[];
  private readonly _vertexList: Vertex[];

  constructor() {
    this._minimaList = [];
    this._vertexList = [];
  }

  public clear(): void {
    this._minimaList.length = 0;
    this._vertexList.length = 0;
  }

  public addPaths(paths: Paths64, pt: PathType, isOpen: boolean): void {
    ClipperEngine.addPathsToVertexList(paths, pt, isOpen, this._minimaList, this._vertexList);
  }
}

class SimpleNavigableSet {
  items: Array<number> = []

  constructor() {
    this.items = [];
  }

  clear(): void { this.items.length = 0 }
  isEmpty(): boolean { return this.items.length == 0 }

  pollLast(): number | undefined {
    return this.items.pop();
  }

  add(item: number) {
    if (!this.items.includes(item)) {
      this.items.push(item);
      this.items.sort((a, b) => a - b);
    }
  }
}

export class ClipperBase {
  private _cliptype: ClipType = ClipType.None
  private _fillrule: FillRule = FillRule.EvenOdd
  private _actives?: Active;
  private _sel?: Active;
  private readonly _minimaList: LocalMinima[];
  private readonly _intersectList: IntersectNode[];
  private readonly _vertexList: Vertex[];
  private readonly _outrecList: OutRec[];
  private readonly _scanlineList: SimpleNavigableSet;
  private readonly _horzSegList: HorzSegment[];
  private readonly _horzJoinList: HorzJoin[];
  private _currentLocMin: number = 0
  private _currentBotY: number = 0
  private _isSortedMinimaList: boolean = false
  private _hasOpenPaths: boolean = false
  protected _using_polytree: boolean = false
  protected _succeeded: boolean = false
  public preserveCollinear: boolean;
  public reverseSolution: boolean = false

  constructor() {
    this._minimaList = [];
    this._intersectList = [];
    this._vertexList = [];
    this._outrecList = [];
    this._scanlineList = new SimpleNavigableSet()
    this._horzSegList = [];
    this._horzJoinList = [];
    this.preserveCollinear = true;
  }

  private static isOdd(val: number): boolean {
    return ((val & 1) !== 0);
  }

  private static isHotEdgeActive(ae: Active): boolean {
    return ae.outrec !== undefined;
  }

  private static isOpen(ae: Active): boolean {
    return ae.localMin.isOpen;
  }

  private static isOpenEndActive(ae: Active): boolean {
    return ae.localMin.isOpen && ClipperBase.isOpenEnd(ae.vertexTop!);
  }

  private static isOpenEnd(v: Vertex): boolean {
    return (v.flags & (VertexFlags.OpenStart | VertexFlags.OpenEnd)) !== VertexFlags.None;
  }

  private static getPrevHotEdge(ae: Active): Active | undefined {
    let prev: Active | undefined = ae.prevInAEL;
    while (prev && (ClipperBase.isOpen(prev) || !ClipperBase.isHotEdgeActive(prev)))
      prev = prev.prevInAEL;
    return prev;
  }

  private static isFront(ae: Active): boolean {
    return ae === ae.outrec!.frontEdge;
  }

  /*******************************************************************************
  *  Dx:                             0(90deg)                                    *
  *                                  |                                           *
  *               +inf (180deg) <--- o --. -inf (0deg)                          *
  *******************************************************************************/

  private static getDx(pt1: IPoint64, pt2: IPoint64): number {
    const dy: number = pt2.y - pt1.y;
    if (dy !== 0)
      return (pt2.x - pt1.x) / dy;
    if (pt2.x > pt1.x)
      return Number.NEGATIVE_INFINITY;
    return Number.POSITIVE_INFINITY;
  }

  private static topX(ae: Active, currentY: number): number {
    if ((currentY === ae.top.y) || (ae.top.x === ae.bot.x)) return ae.top.x;
    if (currentY === ae.bot.y) return ae.bot.x;
    return ae.bot.x + midPointRound(ae.dx * (currentY - ae.bot.y), MidpointRounding.ToEven);
  }

  private static isHorizontal(ae: Active): boolean {
    return (ae.top.y === ae.bot.y);
  }

  private static isHeadingRightHorz(ae: Active): boolean {
    return (Number.NEGATIVE_INFINITY === ae.dx);
  }

  private static isHeadingLeftHorz(ae: Active): boolean {
    return (Number.POSITIVE_INFINITY === ae.dx);
  }

  private static swapActives(ae1: Active, ae2: Active): void {
    [ae2, ae1] = [ae1, ae2];
  }

  private static getPolyType(ae: Active): PathType {
    return ae.localMin.polytype;
  }

  private static isSamePolyType(ae1: Active, ae2: Active): boolean {
    return ae1.localMin.polytype === ae2.localMin.polytype;
  }

  private static setDx(ae: Active): void {
    ae.dx = ClipperBase.getDx(ae.bot, ae.top);
  }

  private static nextVertex(ae: Active): Vertex {
    if (ae.windDx > 0)
      return ae.vertexTop!.next!;
    return ae.vertexTop!.prev!;
  }

  private static prevPrevVertex(ae: Active): Vertex {
    if (ae.windDx > 0)
      return ae.vertexTop!.prev!.prev!;
    return ae.vertexTop!.next!.next!;
  }

  private static isMaxima(vertex: Vertex): boolean {
    return (vertex.flags & VertexFlags.LocalMax) !== VertexFlags.None;
  }

  private static isMaximaActive(ae: Active): boolean {
    return ClipperBase.isMaxima(ae.vertexTop!);
  }

  private static getMaximaPair(ae: Active): Active | undefined {
    let ae2: Active | undefined = ae.nextInAEL;
    while (ae2) {
      if (ae2.vertexTop === ae.vertexTop) return ae2; // Found!
      ae2 = ae2.nextInAEL;
    }
    return undefined;
  }

  private static getCurrYMaximaVertex_Open(ae: Active): Vertex | undefined {
    let result: Vertex | undefined = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result!.next!.pt.y === result!.pt.y &&
        ((result!.flags & (VertexFlags.OpenEnd |
          VertexFlags.LocalMax)) === VertexFlags.None))
        result = result!.next;
    } else {
      while (result!.prev!.pt.y === result!.pt.y &&
        ((result!.flags & (VertexFlags.OpenEnd |
          VertexFlags.LocalMax)) === VertexFlags.None))
        result = result!.prev;
    }
    if (!ClipperBase.isMaxima(result!)) result = undefined; // not a maxima
    return result;
  }

  private static getCurrYMaximaVertex(ae: Active): Vertex | undefined {
    let result: Vertex | undefined = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result!.next!.pt.y === result!.pt.y) result = result!.next;
    } else {
      while (result!.prev!.pt.y === result!.pt.y) result = result!.prev;
    }
    if (!ClipperBase.isMaxima(result!)) result = undefined; // not a maxima
    return result;
  }

  private static setSides(outrec: OutRec, startEdge: Active, endEdge: Active): void {
    outrec.frontEdge = startEdge;
    outrec.backEdge = endEdge;
  }

  private static swapOutrecs(ae1: Active, ae2: Active): void {
    const or1: OutRec | undefined = ae1.outrec;
    const or2: OutRec | undefined = ae2.outrec;
    if (or1 === or2) {
      const ae: Active | undefined = or1!.frontEdge;
      or1!.frontEdge = or1!.backEdge;
      or1!.backEdge = ae;
      return;
    }

    if (or1) {
      if (ae1 === or1.frontEdge)
        or1.frontEdge = ae2;
      else
        or1.backEdge = ae2;
    }

    if (or2) {
      if (ae2 === or2.frontEdge)
        or2.frontEdge = ae1;
      else
        or2.backEdge = ae1;
    }

    ae1.outrec = or2;
    ae2.outrec = or1;
  }

  private static setOwner(outrec: OutRec, newOwner: OutRec): void {
    while (newOwner.owner && !newOwner.owner.pts) {
      newOwner.owner = newOwner.owner.owner;
    }

    //make sure that outrec isn't an owner of newOwner
    let tmp: OutRec | undefined = newOwner;
    while (tmp && tmp !== outrec)
      tmp = tmp.owner;
    if (tmp)
      newOwner.owner = outrec.owner;
    outrec.owner = newOwner;
  }

  private static area(op: OutPt): number {
    // https://en.wikipedia.org/wiki/Shoelace_formula
    let area = 0.0;
    let op2 = op;
    do {
      area += (op2.prev.pt.y + op2.pt.y) *
        (op2.prev.pt.x - op2.pt.x);
      op2 = op2.next!;
    } while (op2 !== op);
    return area * 0.5;
  }

  private static areaTriangle(pt1: IPoint64, pt2: IPoint64, pt3: IPoint64): number {
    return (pt3.y + pt1.y) * (pt3.x - pt1.x) +
      (pt1.y + pt2.y) * (pt1.x - pt2.x) +
      (pt2.y + pt3.y) * (pt2.x - pt3.x);
  }

  private static getRealOutRec(outRec: OutRec | undefined): OutRec | undefined {
    while (outRec !== undefined && outRec.pts === undefined) {
      outRec = outRec.owner;
    }
    return outRec;
  }

  private static isValidOwner(outRec: OutRec | undefined, testOwner: OutRec | undefined): boolean {
    while (testOwner !== undefined && testOwner !== outRec)
      testOwner = testOwner.owner;
    return testOwner === undefined;
  }

  private static uncoupleOutRec(ae: Active): void {
    const outrec = ae.outrec;
    if (outrec === undefined) return;
    outrec.frontEdge!.outrec = undefined;
    outrec.backEdge!.outrec = undefined;
    outrec.frontEdge = undefined;
    outrec.backEdge = undefined;
  }

  private static outrecIsAscending(hotEdge: Active): boolean {
    return (hotEdge === hotEdge.outrec!.frontEdge);
  }

  private static swapFrontBackSides(outrec: OutRec): void {
    // while this proc. is needed for open paths
    // it's almost never needed for closed paths
    const ae2 = outrec.frontEdge!;
    outrec.frontEdge = outrec.backEdge;
    outrec.backEdge = ae2;
    outrec.pts = outrec.pts!.next;
  }

  private static edgesAdjacentInAEL(inode: IntersectNode): boolean {
    return (inode.edge1.nextInAEL === inode.edge2) || (inode.edge1.prevInAEL === inode.edge2);
  }

  protected clearSolutionOnly(): void {
    while (this._actives) this.deleteFromAEL(this._actives);
    this._scanlineList.clear()
    this.disposeIntersectNodes();
    this._outrecList.length = 0
    this._horzSegList.length = 0
    this._horzJoinList.length = 0
  }

  public clear(): void {
    this.clearSolutionOnly();
    this._minimaList.length = 0
    this._vertexList.length = 0
    this._currentLocMin = 0;
    this._isSortedMinimaList = false;
    this._hasOpenPaths = false;
  }

  protected reset(): void {
    if (!this._isSortedMinimaList) {
      this._minimaList.sort((locMin1, locMin2) => locMin2.vertex.pt.y - locMin1.vertex.pt.y);
      this._isSortedMinimaList = true;
    }

    for (let i = this._minimaList.length - 1; i >= 0; i--) {
      this._scanlineList.add(this._minimaList[i].vertex.pt.y);
    }

    this._currentBotY = 0;
    this._currentLocMin = 0;
    this._actives = undefined;
    this._sel = undefined;
    this._succeeded = true;
  }

  private insertScanline(y: number): void {
    this._scanlineList.add(y)
  }

  private popScanline(): number | undefined {
    return this._scanlineList.pollLast();
  }

  private hasLocMinAtY(y: number): boolean {
    return (this._currentLocMin < this._minimaList.length && this._minimaList[this._currentLocMin].vertex.pt.y == y);
  }

  private popLocalMinima(): LocalMinima {
    return this._minimaList[this._currentLocMin++];
  }

  private addLocMin(vert: Vertex, polytype: PathType, isOpen: boolean): void {
    // make sure the vertex is added only once ...
    if ((vert.flags & VertexFlags.LocalMin) != VertexFlags.None) return

    vert.flags |= VertexFlags.LocalMin;

    const lm = new LocalMinima(vert, polytype, isOpen);
    this._minimaList.push(lm);
  }

  public addSubject(path: Path64): void {
    this.addPath(path, PathType.Subject);
  }

  public addOpenSubject(path: Path64): void {
    this.addPath(path, PathType.Subject, true);
  }

  public addClip(path: Path64): void {
    this.addPath(path, PathType.Clip);
  }

  protected addPath(path: Path64, polytype: PathType, isOpen = false): void {
    const tmp: Paths64 = [path];
    this.addPaths(tmp, polytype, isOpen);
  }

  protected addPaths(paths: Paths64, polytype: PathType, isOpen = false): void {
    if (isOpen) this._hasOpenPaths = true;
    this._isSortedMinimaList = false;
    ClipperEngine.addPathsToVertexList(paths, polytype, isOpen, this._minimaList, this._vertexList);
  }

  protected addReuseableData(reuseableData: ReuseableDataContainer64): void {
    if (reuseableData._minimaList.length === 0) return;

    this._isSortedMinimaList = false;
    for (const lm of reuseableData._minimaList) {
      this._minimaList.push(new LocalMinima(lm.vertex, lm.polytype, lm.isOpen));
      if (lm.isOpen) this._hasOpenPaths = true;
    }
  }

  private isContributingClosed(ae: Active): boolean {
    switch (this._fillrule) {
      case FillRule.Positive:
        if (ae.windCount !== 1) return false;
        break;
      case FillRule.Negative:
        if (ae.windCount !== -1) return false;
        break;
      case FillRule.NonZero:
        if (Math.abs(ae.windCount) !== 1) return false;
        break;
    }

    switch (this._cliptype) {
      case ClipType.Intersection:
        switch (this._fillrule) {
          case FillRule.Positive: return ae.windCount2 > 0;
          case FillRule.Negative: return ae.windCount2 < 0;
          default: return ae.windCount2 !== 0;
        }
      case ClipType.Union:
        switch (this._fillrule) {
          case FillRule.Positive: return ae.windCount2 <= 0;
          case FillRule.Negative: return ae.windCount2 >= 0;
          default: return ae.windCount2 === 0;
        }
      case ClipType.Difference:
        const result = this._fillrule === FillRule.Positive ? (ae.windCount2 <= 0) :
          this._fillrule === FillRule.Negative ? (ae.windCount2 >= 0) :
            (ae.windCount2 === 0);
        return ClipperBase.getPolyType(ae) === PathType.Subject ? result : !result;

      case ClipType.Xor:
        return true;

      default:
        return false;
    }
  }

  private isContributingOpen(ae: Active): boolean {
    let isInClip: boolean, isInSubj: boolean;
    switch (this._fillrule) {
      case FillRule.Positive:
        isInSubj = ae.windCount > 0;
        isInClip = ae.windCount2 > 0;
        break;
      case FillRule.Negative:
        isInSubj = ae.windCount < 0;
        isInClip = ae.windCount2 < 0;
        break;
      default:
        isInSubj = ae.windCount !== 0;
        isInClip = ae.windCount2 !== 0;
        break;
    }

    switch (this._cliptype) {
      case ClipType.Intersection:
        return isInClip;
      case ClipType.Union:
        return !isInSubj && !isInClip;
      default:
        return !isInClip;
    }
  }

  private setWindCountForClosedPathEdge(ae: Active): void {
    let ae2: Active | undefined = ae.prevInAEL;
    const pt: PathType = ClipperBase.getPolyType(ae);

    while (ae2 !== undefined && (ClipperBase.getPolyType(ae2) !== pt || ClipperBase.isOpen(ae2))) {
      ae2 = ae2.prevInAEL;
    }

    if (ae2 === undefined) {
      ae.windCount = ae.windDx;
      ae2 = this._actives;
    } else if (this._fillrule === FillRule.EvenOdd) {
      ae.windCount = ae.windDx;
      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;
    } else {
      // NonZero, positive, or negative filling here ...
      // when e2's WindCnt is in the SAME direction as its WindDx,
      // then polygon will fill on the right of 'e2' (and 'e' will be inside)
      // nb: neither e2.WindCnt nor e2.WindDx should ever be 0.
      if (ae2.windCount * ae2.windDx < 0) {
        // opposite directions so 'ae' is outside 'ae2' ...
        if (Math.abs(ae2.windCount) > 1) {
          // outside prev poly but still inside another.
          if (ae2.windDx * ae.windDx < 0)
            // reversing direction so use the same WC
            ae.windCount = ae2.windCount;
          else
            // otherwise keep 'reducing' the WC by 1 (i.e. towards 0) ...
            ae.windCount = ae2.windCount + ae.windDx;
        } else {
          // now outside all polys of same polytype so set own WC ...
          ae.windCount = (ClipperBase.isOpen(ae) ? 1 : ae.windDx);
        }
      } else {
        // 'ae' must be inside 'ae2'
        if (ae2.windDx * ae.windDx < 0)
          // reversing direction so use the same WC
          ae.windCount = ae2.windCount;
        else
          // otherwise keep 'increasing' the WC by 1 (i.e. away from 0) ...
          ae.windCount = ae2.windCount + ae.windDx;
      }

      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;  // i.e. get ready to calc WindCnt2

    }

    if (this._fillrule === FillRule.EvenOdd) {
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2!) !== pt && !ClipperBase.isOpen(ae2!)) {
          ae.windCount2 = (ae.windCount2 === 0 ? 1 : 0);
        }
        ae2 = ae2!.nextInAEL;
      }
    } else {
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2!) !== pt && !ClipperBase.isOpen(ae2!)) {
          ae.windCount2 += ae2!.windDx;
        }
        ae2 = ae2!.nextInAEL;
      }
    }
  }

  private setWindCountForOpenPathEdge(ae: Active) {
    let ae2: Active | undefined = this._actives;
    if (this._fillrule === FillRule.EvenOdd) {
      let cnt1 = 0, cnt2 = 0;
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2!) === PathType.Clip)
          cnt2++;
        else if (!ClipperBase.isOpen(ae2!))
          cnt1++;
        ae2 = ae2!.nextInAEL;
      }

      ae.windCount = (ClipperBase.isOdd(cnt1) ? 1 : 0);
      ae.windCount2 = (ClipperBase.isOdd(cnt2) ? 1 : 0);
    }
    else {
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2!) === PathType.Clip)
          ae.windCount2 += ae2!.windDx;
        else if (!ClipperBase.isOpen(ae2!))
          ae.windCount += ae2!.windDx;
        ae2 = ae2!.nextInAEL;
      }
    }
  }

  private static isValidAelOrder(resident: Active, newcomer: Active): boolean {
    if (newcomer.curX !== resident.curX)
      return newcomer.curX > resident.curX;

    // get the turning direction  a1.top, a2.bot, a2.top
    const d: number = InternalClipper.crossProduct(resident.top, newcomer.bot, newcomer.top);
    if (d !== 0.0) return (d < 0);

    // edges must be collinear to get here

    // for starting open paths, place them according to
    // the direction they're about to turn
    if (!this.isMaximaActive(resident) && (resident.top.y > newcomer.top.y)) {
      return InternalClipper.crossProduct(newcomer.bot,
        resident.top, this.nextVertex(resident).pt) <= 0;
    }

    if (!this.isMaximaActive(newcomer) && (newcomer.top.y > resident.top.y)) {
      return InternalClipper.crossProduct(newcomer.bot,
        newcomer.top, this.nextVertex(newcomer).pt) >= 0;
    }

    const y: number = newcomer.bot.y;
    const newcomerIsLeft: boolean = newcomer.isLeftBound;

    if (resident.bot.y !== y || resident.localMin.vertex.pt.y !== y)
      return newcomer.isLeftBound;
    // resident must also have just been inserted
    if (resident.isLeftBound !== newcomerIsLeft)
      return newcomerIsLeft;
    if (InternalClipper.crossProduct(this.prevPrevVertex(resident).pt,
      resident.bot, resident.top) === 0) return true;
    // compare turning direction of the alternate bound
    return (InternalClipper.crossProduct(this.prevPrevVertex(resident).pt,
      newcomer.bot, this.prevPrevVertex(newcomer).pt) > 0) === newcomerIsLeft;
  }

  private insertLeftEdge(ae: Active): void {
    let ae2: Active;

    if (!this._actives) {
      ae.prevInAEL = undefined;
      ae.nextInAEL = undefined;
      this._actives = ae;
    } else if (!ClipperBase.isValidAelOrder(this._actives, ae)) {
      ae.prevInAEL = undefined;
      ae.nextInAEL = this._actives;
      this._actives.prevInAEL = ae;
      this._actives = ae;
    } else {
      ae2 = this._actives;
      while (ae2.nextInAEL && ClipperBase.isValidAelOrder(ae2.nextInAEL, ae))
        ae2 = ae2.nextInAEL;
      //don't separate joined edges
      if (ae2.joinWith === JoinWith.Right) ae2 = ae2.nextInAEL!;
      ae.nextInAEL = ae2.nextInAEL;
      if (ae2.nextInAEL) ae2.nextInAEL.prevInAEL = ae;
      ae.prevInAEL = ae2;
      ae2.nextInAEL = ae;
    }
  }

  private static insertRightEdge(ae: Active, ae2: Active): void {
    ae2.nextInAEL = ae.nextInAEL;
    if (ae.nextInAEL) ae.nextInAEL.prevInAEL = ae2;
    ae2.prevInAEL = ae;
    ae.nextInAEL = ae2;
  }

  private insertLocalMinimaIntoAEL(botY: number): void {
    let localMinima: LocalMinima;
    let leftBound: Active | undefined;
    let rightBound: Active | undefined;

    // Add any local minima (if any) at BotY ...
    // NB horizontal local minima edges should contain locMin.vertex.prev
    while (this.hasLocMinAtY(botY)) {
      localMinima = this.popLocalMinima();

      if ((localMinima.vertex.flags & VertexFlags.OpenStart) !== VertexFlags.None) {
        leftBound = undefined;
      } else {
        leftBound = new Active()
        leftBound.bot = localMinima.vertex.pt
        leftBound.curX = localMinima.vertex.pt.x
        leftBound.windDx = -1
        leftBound.vertexTop = localMinima.vertex.prev
        leftBound.top = localMinima.vertex.prev!.pt
        leftBound.outrec = undefined
        leftBound.localMin = localMinima

        ClipperBase.setDx(leftBound);
      }

      if ((localMinima.vertex.flags & VertexFlags.OpenEnd) !== VertexFlags.None) {
        rightBound = undefined;
      } else {
        rightBound = new Active()
        rightBound.bot = localMinima.vertex.pt
        rightBound.curX = localMinima.vertex.pt.x
        rightBound.windDx = 1
        rightBound.vertexTop = localMinima.vertex.next
        rightBound.top = localMinima.vertex.next!.pt
        rightBound.outrec = undefined
        rightBound.localMin = localMinima

        ClipperBase.setDx(rightBound);
      }

      if (leftBound && rightBound) {
        if (ClipperBase.isHorizontal(leftBound)) {
          if (ClipperBase.isHeadingRightHorz(leftBound)) {
            [rightBound, leftBound] = [leftBound, rightBound]
          }
        } else if (ClipperBase.isHorizontal(rightBound)) {
          if (ClipperBase.isHeadingLeftHorz(rightBound)) {
            [rightBound, leftBound] = [leftBound, rightBound]
          }
        } else if (leftBound.dx < rightBound.dx) {
          [rightBound, leftBound] = [leftBound, rightBound]
        }
        //so when leftBound has windDx == 1, the polygon will be oriented
        //counter-clockwise in Cartesian coords (clockwise with inverted Y).
      } else if (leftBound === undefined) {
        leftBound = rightBound;
        rightBound = undefined;
      }

      let contributing = false
      leftBound!.isLeftBound = true;
      this.insertLeftEdge(leftBound!);

      if (ClipperBase.isOpen(leftBound!)) {
        this.setWindCountForOpenPathEdge(leftBound!);
        contributing = this.isContributingOpen(leftBound!);
      } else {
        this.setWindCountForClosedPathEdge(leftBound!);
        contributing = this.isContributingClosed(leftBound!);
      }

      if (rightBound) {
        rightBound.windCount = leftBound!.windCount;
        rightBound.windCount2 = leftBound!.windCount2;
        ClipperBase.insertRightEdge(leftBound!, rightBound);

        if (contributing) {
          this.addLocalMinPoly(leftBound!, rightBound, leftBound!.bot, true);
          if (!ClipperBase.isHorizontal(leftBound!)) {
            this.checkJoinLeft(leftBound!, leftBound!.bot);
          }
        }

        while (rightBound.nextInAEL &&
          ClipperBase.isValidAelOrder(rightBound.nextInAEL, rightBound)) {
          this.intersectEdges(rightBound, rightBound.nextInAEL, rightBound.bot);
          this.swapPositionsInAEL(rightBound, rightBound.nextInAEL);
        }

        if (ClipperBase.isHorizontal(rightBound)) {
          this.pushHorz(rightBound);
        } else {
          this.checkJoinRight(rightBound, rightBound.bot);
          this.insertScanline(rightBound.top.y);
        }

      } else if (contributing) {
        this.startOpenPath(leftBound!, leftBound!.bot);
      }

      if (ClipperBase.isHorizontal(leftBound!)) {
        this.pushHorz(leftBound!);
      } else {
        this.insertScanline(leftBound!.top.y);
      }
    }
  }

  private pushHorz(ae: Active): void {
    ae.nextInSEL = this._sel;
    this._sel = ae;
  }

  private popHorz(): Active | undefined {
    const ae = this._sel;
    if (this._sel === undefined) return undefined;
    this._sel = this._sel.nextInSEL;
    return ae;
  }

  private addLocalMinPoly(ae1: Active, ae2: Active, pt: IPoint64, isNew: boolean = false): OutPt {
    const outrec: OutRec = this.newOutRec();
    ae1.outrec = outrec;
    ae2.outrec = outrec;

    if (ClipperBase.isOpen(ae1)) {
      outrec.owner = undefined;
      outrec.isOpen = true;
      if (ae1.windDx > 0)
        ClipperBase.setSides(outrec, ae1, ae2);
      else
        ClipperBase.setSides(outrec, ae2, ae1);
    } else {
      outrec.isOpen = false;
      const prevHotEdge = ClipperBase.getPrevHotEdge(ae1);

      // e.windDx is the winding direction of the **input** paths
      // and unrelated to the winding direction of output polygons.
      // Output orientation is determined by e.outrec.frontE which is
      // the ascending edge (see AddLocalMinPoly).
      if (prevHotEdge) {
        if (this._using_polytree)
          ClipperBase.setOwner(outrec, prevHotEdge.outrec!);
        outrec.owner = prevHotEdge.outrec;

        if (ClipperBase.outrecIsAscending(prevHotEdge) === isNew)
          ClipperBase.setSides(outrec, ae2, ae1);
        else
          ClipperBase.setSides(outrec, ae1, ae2);
      } else {
        outrec.owner = undefined;
        if (isNew)
          ClipperBase.setSides(outrec, ae1, ae2);
        else
          ClipperBase.setSides(outrec, ae2, ae1);
      }
    }

    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }

  private addLocalMaxPoly(ae1: Active, ae2: Active, pt: IPoint64): OutPt | undefined {
    if (ClipperBase.isJoined(ae1)) this.split(ae1, pt);
    if (ClipperBase.isJoined(ae2)) this.split(ae2, pt);

    if (ClipperBase.isFront(ae1) === ClipperBase.isFront(ae2)) {
      if (ClipperBase.isOpenEndActive(ae1))
        ClipperBase.swapFrontBackSides(ae1.outrec!);
      else if (ClipperBase.isOpenEndActive(ae2))
        ClipperBase.swapFrontBackSides(ae2.outrec!);
      else {
        this._succeeded = false;
        return undefined;
      }
    }

    const result = ClipperBase.addOutPt(ae1, pt);
    if (ae1.outrec === ae2.outrec) {
      const outrec = ae1.outrec!;
      outrec.pts = result;

      if (this._using_polytree) {
        const e = ClipperBase.getPrevHotEdge(ae1);
        if (e === undefined)
          outrec.owner = undefined;
        else
          ClipperBase.setOwner(outrec, e.outrec!);
      }
      ClipperBase.uncoupleOutRec(ae1);
    } else if (ClipperBase.isOpen(ae1)) {
      if (ae1.windDx < 0)
        ClipperBase.joinOutrecPaths(ae1, ae2);
      else
        ClipperBase.joinOutrecPaths(ae2, ae1);
    } else if (ae1.outrec!.idx < ae2.outrec!.idx)
      ClipperBase.joinOutrecPaths(ae1, ae2);
    else
      ClipperBase.joinOutrecPaths(ae2, ae1);
    return result;
  }

  private static joinOutrecPaths(ae1: Active, ae2: Active): void {
    // join ae2 outrec path onto ae1 outrec path and then delete ae2 outrec path
    // pointers. (NB Only very rarely do the joining ends share the same coords.)
    const p1Start: OutPt = ae1.outrec!.pts!;
    const p2Start: OutPt = ae2.outrec!.pts!;
    const p1End: OutPt = p1Start.next!;
    const p2End: OutPt = p2Start.next!;

    if (ClipperBase.isFront(ae1)) {
      p2End.prev = p1Start;
      p1Start.next = p2End;
      p2Start.next = p1End;
      p1End.prev = p2Start;

      ae1.outrec!.pts = p2Start;
      // nb: if IsOpen(e1) then e1 & e2 must be a 'maximaPair'
      ae1.outrec!.frontEdge = ae2.outrec!.frontEdge;
      if (ae1.outrec!.frontEdge)
        ae1.outrec!.frontEdge!.outrec = ae1.outrec;
    } else {
      p1End.prev = p2Start;
      p2Start.next = p1End;
      p1Start.next = p2End;
      p2End.prev = p1Start;

      ae1.outrec!.backEdge = ae2.outrec!.backEdge;
      if (ae1.outrec!.backEdge)
        ae1.outrec!.backEdge!.outrec = ae1.outrec;
    }

    // after joining, the ae2.OutRec must contains no vertices ...
    ae2.outrec!.frontEdge = undefined;
    ae2.outrec!.backEdge = undefined;
    ae2.outrec!.pts = undefined;
    ClipperBase.setOwner(ae2.outrec!, ae1.outrec!);

    if (ClipperBase.isOpenEndActive(ae1)) {
      ae2.outrec!.pts = ae1.outrec!.pts;
      ae1.outrec!.pts = undefined;
    }

    // and ae1 and ae2 are maxima and are about to be dropped from the Actives list.
    ae1.outrec = undefined;
    ae2.outrec = undefined;
  }

  private static addOutPt(ae: Active, pt: IPoint64): OutPt {
    const outrec: OutRec = ae.outrec!;
    const toFront: boolean = ClipperBase.isFront(ae);
    const opFront: OutPt = outrec.pts!;
    const opBack: OutPt = opFront.next!;

    if (toFront && (pt == opFront.pt)) return opFront;
    else if (!toFront && (pt == opBack.pt)) return opBack;

    const newOp = new OutPt(pt, outrec);
    opBack.prev = newOp;
    newOp.prev = opFront;
    newOp.next = opBack;
    opFront.next = newOp;

    if (toFront) outrec.pts = newOp;

    return newOp;
  }

  private newOutRec(): OutRec {
    const result = new OutRec(this._outrecList.length);
    this._outrecList.push(result);
    return result;
  }

  private startOpenPath(ae: Active, pt: IPoint64): OutPt {
    const outrec = this.newOutRec();
    outrec.isOpen = true;
    if (ae.windDx > 0) {
      outrec.frontEdge = ae;
      outrec.backEdge = undefined;
    } else {
      outrec.frontEdge = undefined;
      outrec.backEdge = ae;
    }

    ae.outrec = outrec;
    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }

  private updateEdgeIntoAEL(ae: Active): void {
    ae.bot = ae.top!;
    ae.vertexTop = ClipperBase.nextVertex(ae);
    ae.top = ae.vertexTop!.pt;
    ae.curX = ae.bot.x;
    ClipperBase.setDx(ae);

    if (ClipperBase.isJoined(ae)) this.split(ae, ae.bot);

    if (ClipperBase.isHorizontal(ae)) return;
    this.insertScanline(ae.top.y);

    this.checkJoinLeft(ae, ae.bot);
    this.checkJoinRight(ae, ae.bot, true);
  }

  private static findEdgeWithMatchingLocMin(e: Active): Active | undefined {
    let result: Active | undefined = e.nextInAEL;
    while (result) {
      if (result.localMin === e.localMin) return result;
      if (!ClipperBase.isHorizontal(result) && e.bot !== result.bot) result = undefined;
      else result = result.nextInAEL;
    }

    result = e.prevInAEL;
    while (result) {
      if (result.localMin === e.localMin) return result;
      if (!ClipperBase.isHorizontal(result) && e.bot !== result.bot) return undefined;
      result = result.prevInAEL;
    }

    return result;
  }

  private intersectEdges(ae1: Active, ae2: Active, pt: IPoint64): OutPt | undefined {
    let resultOp: OutPt | undefined = undefined;

    // MANAGE OPEN PATH INTERSECTIONS SEPARATELY ...
    if (this._hasOpenPaths && (ClipperBase.isOpen(ae1) || ClipperBase.isOpen(ae2))) {
      if (ClipperBase.isOpen(ae1) && ClipperBase.isOpen(ae2)) return undefined;
      // the following line avoids duplicating quite a bit of code
      if (ClipperBase.isOpen(ae2)) ClipperBase.swapActives(ae1, ae2);
      if (ClipperBase.isJoined(ae2)) this.split(ae2, pt);

      if (this._cliptype === ClipType.Union) {
        if (!ClipperBase.isHotEdgeActive(ae2)) return undefined;
      } else if (ae2.localMin.polytype === PathType.Subject)
        return undefined;

      switch (this._fillrule) {
        case FillRule.Positive:
          if (ae2.windCount !== 1) return undefined;
          break;
        case FillRule.Negative:
          if (ae2.windCount !== -1) return undefined;
          break;
        default:
          if (Math.abs(ae2.windCount) !== 1) return undefined;
          break;
      }

      // toggle contribution ...
      if (ClipperBase.isHotEdgeActive(ae1)) {
        resultOp = ClipperBase.addOutPt(ae1, pt);
        if (ClipperBase.isFront(ae1)) {
          ae1.outrec!.frontEdge = undefined;
        } else {
          ae1.outrec!.backEdge = undefined;
        }
        ae1.outrec = undefined;

        // horizontal edges can pass under open paths at a LocMins
      } else if (pt === ae1.localMin.vertex.pt && !ClipperBase.isOpenEnd(ae1.localMin.vertex)) {
        // find the other side of the LocMin and
        // if it's 'hot' join up with it ...
        const ae3: Active | undefined = ClipperBase.findEdgeWithMatchingLocMin(ae1);
        if (ae3 && ClipperBase.isHotEdgeActive(ae3)) {
          ae1.outrec = ae3.outrec;
          if (ae1.windDx > 0) {
            ClipperBase.setSides(ae3.outrec!, ae1, ae3);
          } else {
            ClipperBase.setSides(ae3.outrec!, ae3, ae1);
          }
          return ae3.outrec!.pts;
        }
        resultOp = this.startOpenPath(ae1, pt);
      } else {
        resultOp = this.startOpenPath(ae1, pt);
      }

      return resultOp;
    }

    // MANAGING CLOSED PATHS FROM HERE ON
    if (ClipperBase.isJoined(ae1)) this.split(ae1, pt);
    if (ClipperBase.isJoined(ae2)) this.split(ae2, pt);

    // UPDATE WINDING COUNTS...
    let oldE1WindCount: number;
    let oldE2WindCount: number;

    if (ae1.localMin.polytype === ae2.localMin.polytype) {
      if (this._fillrule === FillRule.EvenOdd) {
        oldE1WindCount = ae1.windCount;
        ae1.windCount = ae2.windCount;
        ae2.windCount = oldE1WindCount;
      } else {
        if (ae1.windCount + ae2.windDx === 0)
          ae1.windCount = -ae1.windCount;
        else
          ae1.windCount += ae2.windDx;
        if (ae2.windCount - ae1.windDx === 0)
          ae2.windCount = -ae2.windCount;
        else
          ae2.windCount -= ae1.windDx;
      }
    } else {
      if (this._fillrule !== FillRule.EvenOdd)
        ae1.windCount2 += ae2.windDx;
      else
        ae1.windCount2 = (ae1.windCount2 === 0 ? 1 : 0);
      if (this._fillrule !== FillRule.EvenOdd)
        ae2.windCount2 -= ae1.windDx;
      else
        ae2.windCount2 = (ae2.windCount2 === 0 ? 1 : 0);
    }

    switch (this._fillrule) {
      case FillRule.Positive:
        oldE1WindCount = ae1.windCount;
        oldE2WindCount = ae2.windCount;
        break;
      case FillRule.Negative:
        oldE1WindCount = -ae1.windCount;
        oldE2WindCount = -ae2.windCount;
        break;
      default:
        oldE1WindCount = Math.abs(ae1.windCount);
        oldE2WindCount = Math.abs(ae2.windCount);
        break;
    }

    const e1WindCountIs0or1: boolean = oldE1WindCount === 0 || oldE1WindCount === 1;
    const e2WindCountIs0or1: boolean = oldE2WindCount === 0 || oldE2WindCount === 1;

    if ((!ClipperBase.isHotEdgeActive(ae1) && !e1WindCountIs0or1) || (!ClipperBase.isHotEdgeActive(ae2) && !e2WindCountIs0or1)) return undefined;

    // NOW PROCESS THE INTERSECTION ...

    // if both edges are 'hot' ...
    if (ClipperBase.isHotEdgeActive(ae1) && ClipperBase.isHotEdgeActive(ae2)) {
      if ((oldE1WindCount !== 0 && oldE1WindCount !== 1) ||
        (oldE2WindCount !== 0 && oldE2WindCount !== 1) ||
        (ae1.localMin.polytype !== ae2.localMin.polytype &&
          this._cliptype !== ClipType.Xor)) {
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
      } else if (ClipperBase.isFront(ae1) || (ae1.outrec === ae2.outrec)) {
        // this 'else if' condition isn't strictly needed but
        // it's sensible to split polygons that only touch at
        // a common vertex (not at common edges).
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
        this.addLocalMinPoly(ae1, ae2, pt);
      } else {
        // can't treat as maxima & minima
        resultOp = ClipperBase.addOutPt(ae1, pt);
        ClipperBase.addOutPt(ae2, pt);
        ClipperBase.swapOutrecs(ae1, ae2);
      }
    }
    // if one or the other edge is 'hot' ...
    else if (ClipperBase.isHotEdgeActive(ae1)) {
      resultOp = ClipperBase.addOutPt(ae1, pt);
      ClipperBase.swapOutrecs(ae1, ae2);
    } else if (ClipperBase.isHotEdgeActive(ae2)) {
      resultOp = ClipperBase.addOutPt(ae2, pt);
      ClipperBase.swapOutrecs(ae1, ae2);
    }

    // neither edge is 'hot'
    else {
      let e1Wc2: number;
      let e2Wc2: number;

      switch (this._fillrule) {
        case FillRule.Positive:
          e1Wc2 = ae1.windCount2;
          e2Wc2 = ae2.windCount2;
          break;
        case FillRule.Negative:
          e1Wc2 = -ae1.windCount2;
          e2Wc2 = -ae2.windCount2;
          break;
        default:
          e1Wc2 = Math.abs(ae1.windCount2);
          e2Wc2 = Math.abs(ae2.windCount2);
          break;
      }

      if (!ClipperBase.isSamePolyType(ae1, ae2)) {
        resultOp = this.addLocalMinPoly(ae1, ae2, pt);
      } else if (oldE1WindCount === 1 && oldE2WindCount === 1) {
        resultOp = undefined;

        switch (this._cliptype) {
          case ClipType.Union:
            if (e1Wc2 > 0 && e2Wc2 > 0) return undefined;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;

          case ClipType.Difference:
            if (((ClipperBase.getPolyType(ae1) === PathType.Clip) && (e1Wc2 > 0) && (e2Wc2 > 0)) ||
              ((ClipperBase.getPolyType(ae1) === PathType.Subject) && (e1Wc2 <= 0) && (e2Wc2 <= 0))) {
              resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            }
            break;

          case ClipType.Xor:
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;

          default: // ClipType.Intersection:
            if (e1Wc2 <= 0 || e2Wc2 <= 0) return undefined;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
        }
      }
    }

    return resultOp;
  }


  private deleteFromAEL(ae: Active): void {
    const prev: Active | undefined = ae.prevInAEL;
    const next: Active | undefined = ae.nextInAEL;
    if (!prev && !next && ae !== this._actives) return;  // already deleted

    if (prev)
      prev.nextInAEL = next;
    else
      this._actives = next;

    if (next)
      next.prevInAEL = prev;
  }

  private adjustCurrXAndCopyToSEL(topY: number): void {
    let ae: Active | undefined = this._actives;
    this._sel = ae;
    while (ae) {
      ae.prevInSEL = ae.prevInAEL;
      ae.nextInSEL = ae.nextInAEL;
      ae.jump = ae.nextInSEL;
      if (ae.joinWith === JoinWith.Left)
        ae.curX = ae.prevInAEL!.curX;  // This also avoids complications
      else
        ae.curX = ClipperBase.topX(ae, topY);
      // NB don't update ae.curr.Y yet (see AddNewIntersectNode)
      ae = ae.nextInAEL;
    }
  }

  protected executeInternal(ct: ClipType, fillRule: FillRule): void {
    if (ct === ClipType.None) return;
    this._fillrule = fillRule;
    this._cliptype = ct;
    this.reset();

    let y = this.popScanline()
    if (y === undefined) return

    while (this._succeeded) {
      this.insertLocalMinimaIntoAEL(y)
      let ae = this.popHorz()
      while (ae) {
        this.doHorizontal(ae)
        ae = this.popHorz()
      }

      if (this._horzSegList.length > 0) {
        this.convertHorzSegsToJoins();
        this._horzSegList.length = 0
      }
      this._currentBotY = y;  // bottom of scanbeam

      y = this.popScanline()
      if (y === undefined) break;  // y new top of scanbeam

      this.doIntersections(y);
      this.doTopOfScanbeam(y);

      ae = this.popHorz()
      while (ae) {
        this.doHorizontal(ae)
        ae = this.popHorz()
      }
    }
    if (this._succeeded) this.processHorzJoins();
  }

  private doIntersections(topY: number): void {
    if (this.buildIntersectList(topY)) {
      this.processIntersectList();
      this.disposeIntersectNodes();
    }
  }

  private disposeIntersectNodes(): void {
    this._intersectList.length = 0
  }

  private addNewIntersectNode(ae1: Active, ae2: Active, topY: number): void {
    const result = InternalClipper.getIntersectPoint(ae1.bot, ae1.top, ae2.bot, ae2.top)
    let ip: IPoint64 = result.ip
    if (!result.success) {
      ip = new Point64(ae1.curX, topY);
    }

    if (ip.y > this._currentBotY || ip.y < topY) {
      const absDx1: number = Math.abs(ae1.dx);
      const absDx2: number = Math.abs(ae2.dx);
      if (absDx1 > 100 && absDx2 > 100) {
        if (absDx1 > absDx2) {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
        } else {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
        }
      } else if (absDx1 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
      } else if (absDx2 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
      } else {
        if (ip.y < topY) {
          ip.y = topY;
        } else {
          ip.y = this._currentBotY;
        }
        if (absDx1 < absDx2) {
          ip.x = ClipperBase.topX(ae1, ip.y);
        } else {
          ip.x = ClipperBase.topX(ae2, ip.y);
        }
      }
    }
    const node: IntersectNode = new IntersectNode(ip, ae1, ae2);
    this._intersectList.push(node);
  }

  private static extractFromSEL(ae: Active): Active | undefined {
    const res: Active | undefined = ae.nextInSEL;
    if (res) {
      res.prevInSEL = ae.prevInSEL;
    }
    ae.prevInSEL!.nextInSEL = res;
    return res;
  }

  private static insert1Before2InSEL(ae1: Active, ae2: Active): void {
    ae1.prevInSEL = ae2.prevInSEL;
    if (ae1.prevInSEL) {
      ae1.prevInSEL.nextInSEL = ae1;
    }
    ae1.nextInSEL = ae2;
    ae2.prevInSEL = ae1;
  }

  private buildIntersectList(topY: number): boolean {
    if (!this._actives || !this._actives.nextInAEL) return false;

    // Calculate edge positions at the top of the current scanbeam, and from this
    // we will determine the intersections required to reach these new positions.
    this.adjustCurrXAndCopyToSEL(topY);

    // Find all edge intersections in the current scanbeam using a stable merge
    // sort that ensures only adjacent edges are intersecting. Intersect info is
    // stored in FIntersectList ready to be processed in ProcessIntersectList.
    // Re merge sorts see https://stackoverflow.com/a/46319131/359538

    let left: Active | undefined = this._sel,
      right: Active | undefined,
      lEnd: Active | undefined,
      rEnd: Active | undefined,
      currBase: Active | undefined,
      prevBase: Active | undefined,
      tmp: Active | undefined;

    while (left!.jump) {
      prevBase = undefined;
      while (left && left.jump) {
        currBase = left;
        right = left.jump;
        lEnd = right;
        rEnd = right!.jump;
        left.jump = rEnd;
        while (left !== lEnd && right !== rEnd) {
          if (right!.curX < left!.curX) {
            tmp = right!.prevInSEL!;
            for (; ;) {
              this.addNewIntersectNode(tmp, right!, topY);
              if (tmp === left) break;
              tmp = tmp.prevInSEL!;
            }

            tmp = right;
            right = ClipperBase.extractFromSEL(tmp!);
            lEnd = right;
            ClipperBase.insert1Before2InSEL(tmp!, left!);
            if (left === currBase) {
              currBase = tmp;
              currBase!.jump = rEnd;
              if (prevBase === undefined) this._sel = currBase;
              else prevBase.jump = currBase;
            }
          } else {
            left = left!.nextInSEL;
          }
        }

        prevBase = currBase;
        left = rEnd;
      }
      left = this._sel;
    }

    return this._intersectList.length > 0;
  }

  private processIntersectList(): void {
    // We now have a list of intersections required so that edges will be
    // correctly positioned at the top of the scanbeam. However, it's important
    // that edge intersections are processed from the bottom up, but it's also
    // crucial that intersections only occur between adjacent edges.

    // First we do a quicksort so intersections proceed in a bottom up order ...
    this._intersectList.sort((a, b) => {
      if (a.pt.y === b.pt.y) {
        if (a.pt.x === b.pt.x) return 0;
        return (a.pt.x < b.pt.x) ? -1 : 1;
      }
      return (a.pt.y > b.pt.y) ? -1 : 1;
    });

    // Now as we process these intersections, we must sometimes adjust the order
    // to ensure that intersecting edges are always adjacent ...
    for (let i = 0; i < this._intersectList.length; ++i) {
      if (!ClipperBase.edgesAdjacentInAEL(this._intersectList[i])) {
        let j = i + 1;
        while (!ClipperBase.edgesAdjacentInAEL(this._intersectList[j])) j++;
        // swap
        [this._intersectList[j], this._intersectList[i]] =
          [this._intersectList[i], this._intersectList[j]];
      }

      const node = this._intersectList[i];
      this.intersectEdges(node.edge1, node.edge2, node.pt);
      this.swapPositionsInAEL(node.edge1, node.edge2);

      node.edge1.curX = node.pt.x;
      node.edge2.curX = node.pt.x;
      this.checkJoinLeft(node.edge2, node.pt, true);
      this.checkJoinRight(node.edge1, node.pt, true);
    }
  }

  private swapPositionsInAEL(ae1: Active, ae2: Active): void {
    // preconditon: ae1 must be immediately to the left of ae2
    const next: Active | undefined = ae2.nextInAEL;
    if (next) next.prevInAEL = ae1;
    const prev: Active | undefined = ae1.prevInAEL;
    if (prev) prev.nextInAEL = ae2;
    ae2.prevInAEL = prev;
    ae2.nextInAEL = ae1;
    ae1.prevInAEL = ae2;
    ae1.nextInAEL = next;
    if (!ae2.prevInAEL) this._actives = ae2;
  }

  private static resetHorzDirection(horz: Active, vertexMax: Vertex | undefined): { isLeftToRight: boolean, leftX: number, rightX: number } {
    let leftX, rightX

    if (horz.bot.x === horz.top.x) {
      // the horizontal edge is going nowhere ...
      leftX = horz.curX;
      rightX = horz.curX;
      let ae: Active | undefined = horz.nextInAEL;
      while (ae && ae.vertexTop !== vertexMax)
        ae = ae.nextInAEL;
      return { isLeftToRight: ae !== undefined, leftX, rightX }
    }

    if (horz.curX < horz.top.x) {
      leftX = horz.curX;
      rightX = horz.top.x;
      return { isLeftToRight: true, leftX, rightX }
    }
    leftX = horz.top.x;
    rightX = horz.curX;
    return { isLeftToRight: false, leftX, rightX } // right to left
  }

  private static horzIsSpike(horz: Active): boolean {
    const nextPt: IPoint64 = ClipperBase.nextVertex(horz).pt;
    return (horz.bot.x < horz.top.x) !== (horz.top.x < nextPt.x);
  }

  private static trimHorz(horzEdge: Active, preserveCollinear: boolean): void {
    let wasTrimmed = false;
    let pt: IPoint64 = ClipperBase.nextVertex(horzEdge).pt;

    while (pt.y === horzEdge.top.y) {
      // always trim 180 deg. spikes (in closed paths)
      // but otherwise break if preserveCollinear = true
      if (preserveCollinear &&
        (pt.x < horzEdge.top.x) !== (horzEdge.bot.x < horzEdge.top.x)) {
        break;
      }

      horzEdge.vertexTop = ClipperBase.nextVertex(horzEdge);
      horzEdge.top = pt;
      wasTrimmed = true;
      if (ClipperBase.isMaximaActive(horzEdge)) break;
      pt = ClipperBase.nextVertex(horzEdge).pt;
    }
    if (wasTrimmed) ClipperBase.setDx(horzEdge); // +/-infinity
  }

  private addToHorzSegList(op: OutPt): void {
    if (op.outrec.isOpen) return;
    this._horzSegList.push(new HorzSegment(op));
  }

  private getLastOp(hotEdge: Active): OutPt {
    const outrec: OutRec = hotEdge.outrec!;
    return (hotEdge === outrec.frontEdge) ?
      outrec.pts! : outrec.pts!.next!;
  }

  /*******************************************************************************
  * Notes: Horizontal edges (HEs) at scanline intersections (i.e. at the top or    *
  * bottom of a scanbeam) are processed as if layered.The order in which HEs     *
  * are processed doesn't matter. HEs intersect with the bottom vertices of      *
  * other HEs[#] and with non-horizontal edges [*]. Once these intersections     *
  * are completed, intermediate HEs are 'promoted' to the next edge in their     *
  * bounds, and they in turn may be intersected[%] by other HEs.                 *
  *                                                                              *
  * eg: 3 horizontals at a scanline:    /   |                     /           /  *
  *              |                     /    |     (HE3)o ========%========== o   *
  *              o ======= o(HE2)     /     |         /         /                *
  *          o ============#=========*======*========#=========o (HE1)           *
  *         /              |        /       |       /                            *
  *******************************************************************************/
  private doHorizontal(horz: Active): void {
    let pt: IPoint64;
    const horzIsOpen = ClipperBase.isOpen(horz);
    const Y = horz.bot.y;

    const vertex_max: Vertex | undefined = horzIsOpen ?
      ClipperBase.getCurrYMaximaVertex_Open(horz) :
      ClipperBase.getCurrYMaximaVertex(horz);

    // remove 180 deg.spikes and also simplify
    // consecutive horizontals when PreserveCollinear = true
    if (vertex_max && !horzIsOpen && vertex_max !== horz.vertexTop)
      ClipperBase.trimHorz(horz, this.preserveCollinear);

    let { isLeftToRight, leftX, rightX } =
      ClipperBase.resetHorzDirection(horz, vertex_max);

    if (ClipperBase.isHotEdgeActive(horz)) {
      const op = ClipperBase.addOutPt(horz, new Point64(horz.curX, Y));
      this.addToHorzSegList(op);
    }

    for (; ;) {
      // loops through consec. horizontal edges (if open)
      let ae: Active | undefined = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;

      while (ae) {
        if (ae.vertexTop === vertex_max) {
          // do this first!!
          if (ClipperBase.isHotEdgeActive(horz) && ClipperBase.isJoined(ae)) this.split(ae, ae.top);

          if (ClipperBase.isHotEdgeActive(horz)) {
            while (horz.vertexTop !== vertex_max) {
              ClipperBase.addOutPt(horz, horz.top);
              this.updateEdgeIntoAEL(horz);
            }
            if (isLeftToRight)
              this.addLocalMaxPoly(horz, ae, horz.top);
            else
              this.addLocalMaxPoly(ae, horz, horz.top);
          }
          this.deleteFromAEL(ae);
          this.deleteFromAEL(horz);
          return;
        }

        // if horzEdge is a maxima, keep going until we reach
        // its maxima pair, otherwise check for break conditions
        if (vertex_max !== horz.vertexTop || ClipperBase.isOpenEndActive(horz)) {
          // otherwise stop when 'ae' is beyond the end of the horizontal line
          if ((isLeftToRight && ae.curX > rightX) || (!isLeftToRight && ae.curX < leftX)) break;

          if (ae.curX === horz.top.x && !ClipperBase.isHorizontal(ae)) {
            pt = ClipperBase.nextVertex(horz).pt;

            // to maximize the possibility of putting open edges into
            // solutions, we'll only break if it's past HorzEdge's end
            if (ClipperBase.isOpen(ae) && !ClipperBase.isSamePolyType(ae, horz) && !ClipperBase.isHotEdgeActive(ae)) {
              if ((isLeftToRight && (ClipperBase.topX(ae, pt.y) > pt.x)) || (!isLeftToRight && (ClipperBase.topX(ae, pt.y) < pt.x))) break;
            }
            // otherwise for edges at horzEdge's end, only stop when horzEdge's
            // outslope is greater than e's slope when heading right or when
            // horzEdge's outslope is less than e's slope when heading left.
            else if ((isLeftToRight && (ClipperBase.topX(ae, pt.y) >= pt.x)) || (!isLeftToRight && (ClipperBase.topX(ae, pt.y) <= pt.x))) break;
          }
        }

        pt = new Point64(ae.curX, Y);

        if (isLeftToRight) {
          this.intersectEdges(horz, ae, pt);
          this.swapPositionsInAEL(horz, ae);
          horz.curX = ae.curX;
          ae = horz.nextInAEL;
        } else {
          this.intersectEdges(ae, horz, pt);
          this.swapPositionsInAEL(ae, horz);
          horz.curX = ae.curX;
          ae = horz.prevInAEL;
        }

        if (ClipperBase.isHotEdgeActive(horz))
          this.addToHorzSegList(this.getLastOp(horz));
      } // we've reached the end of this horizontal

      // check if we've finished looping
      // through consecutive horizontals
      if (horzIsOpen && ClipperBase.isOpenEndActive(horz)) { // ie open at top
        if (ClipperBase.isHotEdgeActive(horz)) {
          ClipperBase.addOutPt(horz, horz.top);
          if (ClipperBase.isFront(horz))
            horz.outrec!.frontEdge = undefined;
          else
            horz.outrec!.backEdge = undefined;
          horz.outrec = undefined;
        }
        this.deleteFromAEL(horz);
        return;
      } else if (ClipperBase.nextVertex(horz).pt.y !== horz.top.y)
        break;

      // still more horizontals in bound to process ...
      if (ClipperBase.isHotEdgeActive(horz)) {
        ClipperBase.addOutPt(horz, horz.top);
      }

      this.updateEdgeIntoAEL(horz);

      if (this.preserveCollinear && !horzIsOpen && ClipperBase.horzIsSpike(horz)) {
        ClipperBase.trimHorz(horz, true);
      }

      const result = ClipperBase.resetHorzDirection(horz, vertex_max);
      isLeftToRight = result.isLeftToRight
      leftX = result.leftX
      rightX = result.rightX
    }

    if (ClipperBase.isHotEdgeActive(horz)) {
      const op = ClipperBase.addOutPt(horz, horz.top);
      this.addToHorzSegList(op);
    }

    this.updateEdgeIntoAEL(horz);
  }

  private doTopOfScanbeam(y: number): void {
    this._sel = undefined; // _sel is reused to flag horizontals (see pushHorz below)
    let ae: Active | undefined = this._actives;

    while (ae) {
      // NB 'ae' will never be horizontal here
      if (ae.top.y === y) {
        ae.curX = ae.top.x;

        if (ClipperBase.isMaximaActive(ae)) {
          ae = this.doMaxima(ae); // TOP OF BOUND (MAXIMA)
          continue;
        }

        // INTERMEDIATE VERTEX ...
        if (ClipperBase.isHotEdgeActive(ae))
          ClipperBase.addOutPt(ae, ae.top);

        this.updateEdgeIntoAEL(ae);

        if (ClipperBase.isHorizontal(ae))
          this.pushHorz(ae); // horizontals are processed later
      } else { // i.e. not the top of the edge
        ae.curX = ClipperBase.topX(ae, y);
      }

      ae = ae.nextInAEL;
    }
  }

  private doMaxima(ae: Active): Active | undefined {
    const prevE: Active | undefined = ae.prevInAEL
    let nextE: Active | undefined = ae.nextInAEL

    if (ClipperBase.isOpenEndActive(ae)) {
      if (ClipperBase.isHotEdgeActive(ae)) ClipperBase.addOutPt(ae, ae.top);
      if (!ClipperBase.isHorizontal(ae)) {
        if (ClipperBase.isHotEdgeActive(ae)) {
          if (ClipperBase.isFront(ae))
            ae.outrec!.frontEdge = undefined;
          else
            ae.outrec!.backEdge = undefined;
          ae.outrec = undefined;
        }
        this.deleteFromAEL(ae);
      }
      return nextE;
    }

    const maxPair: Active | undefined = ClipperBase.getMaximaPair(ae);
    if (!maxPair) return nextE; // eMaxPair is horizontal

    if (ClipperBase.isJoined(ae)) this.split(ae, ae.top);
    if (ClipperBase.isJoined(maxPair)) this.split(maxPair, maxPair.top);

    // only non-horizontal maxima here.
    // process any edges between maxima pair ...
    while (nextE !== maxPair) {
      this.intersectEdges(ae, nextE!, ae.top);
      this.swapPositionsInAEL(ae, nextE!);
      nextE = ae.nextInAEL
    }

    if (ClipperBase.isOpen(ae)) {
      if (ClipperBase.isHotEdgeActive(ae))
        this.addLocalMaxPoly(ae, maxPair, ae.top);
      this.deleteFromAEL(maxPair);
      this.deleteFromAEL(ae);
      return (prevE ? prevE.nextInAEL : this._actives);
    }

    // here ae.nextInAel == ENext == EMaxPair ...
    if (ClipperBase.isHotEdgeActive(ae))
      this.addLocalMaxPoly(ae, maxPair, ae.top);

    this.deleteFromAEL(ae);
    this.deleteFromAEL(maxPair);
    return (prevE ? prevE.nextInAEL : this._actives);
  }

  private static isJoined(e: Active): boolean {
    return e.joinWith !== JoinWith.None;
  }

  private split(e: Active, currPt: IPoint64): void {
    if (e.joinWith === JoinWith.Right) {
      e.joinWith = JoinWith.None;
      e.nextInAEL!.joinWith = JoinWith.None;
      this.addLocalMinPoly(e, e.nextInAEL!, currPt, true);
    } else {
      e.joinWith = JoinWith.None;
      e.prevInAEL!.joinWith = JoinWith.None;
      this.addLocalMinPoly(e.prevInAEL!, e, currPt, true);
    }
  }

  private checkJoinLeft(e: Active, pt: IPoint64, checkCurrX: boolean = false): void {
    const prev = e.prevInAEL;
    if (!prev || ClipperBase.isOpen(e) || ClipperBase.isOpen(prev) ||
      !ClipperBase.isHotEdgeActive(e) || !ClipperBase.isHotEdgeActive(prev)) return;

    if ((pt.y < e.top.y + 2 || pt.y < prev.top.y + 2) && // avoid trivial joins
      ((e.bot.y > pt.y) || (prev.bot.y > pt.y))) return; // (#490)

    if (checkCurrX) {
      if (Clipper.perpendicDistFromLineSqrd(pt, prev.bot, prev.top) > 0.25) return;
    } else if (e.curX !== prev.curX) return;
    if (InternalClipper.crossProduct(e.top, pt, prev.top) !== 0) return;

    if (e.outrec!.idx === prev.outrec!.idx)
      this.addLocalMaxPoly(prev, e, pt);
    else if (e.outrec!.idx < prev.outrec!.idx)
      ClipperBase.joinOutrecPaths(e, prev);
    else
      ClipperBase.joinOutrecPaths(prev, e);
    prev.joinWith = JoinWith.Right;
    e.joinWith = JoinWith.Left;
  }

  private checkJoinRight(e: Active, pt: IPoint64, checkCurrX: boolean = false): void {
    const next = e.nextInAEL;
    if (ClipperBase.isOpen(e) || !ClipperBase.isHotEdgeActive(e) || ClipperBase.isJoined(e) ||
      !next || ClipperBase.isOpen(next) || !ClipperBase.isHotEdgeActive(next)) return;

    if ((pt.y < e.top.y + 2 || pt.y < next.top.y + 2) && // avoid trivial joins
      ((e.bot.y > pt.y) || (next.bot.y > pt.y))) return; // (#490)

    if (checkCurrX) {
      if (Clipper.perpendicDistFromLineSqrd(pt, next.bot, next.top) > 0.25) return;
    } else if (e.curX !== next.curX) return;
    if (InternalClipper.crossProduct(e.top, pt, next.top) !== 0) return;

    if (e.outrec!.idx === next.outrec!.idx)
      this.addLocalMaxPoly(e, next, pt);
    else if (e.outrec!.idx < next.outrec!.idx)
      ClipperBase.joinOutrecPaths(e, next);
    else
      ClipperBase.joinOutrecPaths(next, e);
    e.joinWith = JoinWith.Right;
    next.joinWith = JoinWith.Left;
  }

  private static fixOutRecPts(outrec: OutRec): void {
    let op = outrec.pts!;
    do {
      op!.outrec = outrec;
      op = op.next!;
    } while (op !== outrec.pts);
  }

  private static setHorzSegHeadingForward(hs: HorzSegment, opP: OutPt, opN: OutPt): boolean {
    if (opP.pt.x === opN.pt.x) return false;
    if (opP.pt.x < opN.pt.x) {
      hs.leftOp = opP;
      hs.rightOp = opN;
      hs.leftToRight = true;
    } else {
      hs.leftOp = opN;
      hs.rightOp = opP;
      hs.leftToRight = false;
    }
    return true;
  }

  private static updateHorzSegment(hs: HorzSegment): boolean {
    const op = hs.leftOp;
    const outrec = this.getRealOutRec(op.outrec)!;
    const outrecHasEdges = outrec.frontEdge !== undefined;
    const curr_y = op.pt.y;
    let opP = op, opN = op;

    if (outrecHasEdges) {
      const opA = outrec.pts!, opZ = opA.next!;
      while (opP !== opZ && opP.prev.pt.y === curr_y)
        opP = opP.prev;
      while (opN !== opA && opN.next!.pt.y === curr_y)
        opN = opN.next!;
    } else {
      while (opP.prev !== opN && opP.prev.pt.y === curr_y)
        opP = opP.prev;
      while (opN.next !== opP && opN.next!.pt.y === curr_y)
        opN = opN.next!;
    }

    const result = this.setHorzSegHeadingForward(hs, opP, opN) && hs.leftOp!.horz === undefined;

    if (result)
      hs.leftOp!.horz = hs;
    else
      hs.rightOp = undefined; // (for sorting)

    return result;
  }

  private static duplicateOp(op: OutPt, insert_after: boolean): OutPt {
    const result = new OutPt(op.pt, op.outrec);
    if (insert_after) {
      result.next = op.next;
      result.next!.prev = result;
      result.prev = op;
      op.next = result;
    } else {
      result.prev = op.prev;
      result.prev.next = result;
      result.next = op;
      op.prev = result;
    }
    return result;
  }

  private convertHorzSegsToJoins(): void {
    let k = 0;
    for (const hs of this._horzSegList) {
      if (ClipperBase.updateHorzSegment(hs)) k++;
    }
    if (k < 2) return;
    this._horzSegList.sort((hs1, hs2) => {
      if (!hs1 || !hs2) return 0;
      if (!hs1.rightOp) {
        return !hs2.rightOp ? 0 : 1;
      } else if (!hs2.rightOp)
        return -1;
      else
        return hs1.leftOp!.pt.x - hs2.leftOp!.pt.x;
    });

    for (let i = 0; i < k - 1; i++) {
      const hs1 = this._horzSegList[i];
      // for each HorzSegment, find others that overlap
      for (let j = i + 1; j < k; j++) {
        const hs2 = this._horzSegList[j];
        if (hs2.leftOp!.pt.x >= hs1.rightOp!.pt.x ||
          hs2.leftToRight === hs1.leftToRight ||
          hs2.rightOp!.pt.x <= hs1.leftOp!.pt.x) continue;

        const curr_y = hs1.leftOp.pt.y;

        if (hs1.leftToRight) {
          while (hs1.leftOp.next!.pt.y === curr_y &&
            hs1.leftOp.next!.pt.x <= hs2.leftOp.pt.x) {
            hs1.leftOp = hs1.leftOp.next!;
          }
          while (hs2.leftOp.prev.pt.y === curr_y &&
            hs2.leftOp.prev.pt.x <= hs1.leftOp.pt.x) {
            hs2.leftOp = hs2.leftOp.prev;
          }
          const join = new HorzJoin(
            ClipperBase.duplicateOp(hs1.leftOp, true),
            ClipperBase.duplicateOp(hs2.leftOp, false)
          );
          this._horzJoinList.push(join);
        } else {
          while (hs1.leftOp.prev.pt.y === curr_y &&
            hs1.leftOp.prev.pt.x <= hs2.leftOp.pt.x) {
            hs1.leftOp = hs1.leftOp.prev;
          }
          while (hs2.leftOp.next!.pt.y === curr_y &&
            hs2.leftOp.next!.pt.x <= hs1.leftOp.pt.x) {
            hs2.leftOp = hs2.leftOp.next!;
          }
          const join = new HorzJoin(
            ClipperBase.duplicateOp(hs2.leftOp, true),
            ClipperBase.duplicateOp(hs1.leftOp, false)
          );
          this._horzJoinList.push(join);
        }
      }
    }
  }

  private static getCleanPath(op: OutPt): Path64 {
    const result = new Path64();
    let op2 = op;
    while (op2.next !== op &&
      ((op2.pt.x === op2.next!.pt.x && op2.pt.x === op2.prev.pt.x) ||
        (op2.pt.y === op2.next!.pt.y && op2.pt.y === op2.prev.pt.y))) {
      op2 = op2.next!;
    }
    result.push(op2.pt);
    let prevOp = op2;
    op2 = op2.next!;

    while (op2 !== op) {
      if ((op2.pt.x !== op2.next!.pt.x || op2.pt.x !== prevOp.pt.x) &&
        (op2.pt.y !== op2.next!.pt.y || op2.pt.y !== prevOp.pt.y)) {
        result.push(op2.pt);
        prevOp = op2;
      }
      op2 = op2.next!;
    }
    return result;
  }

  private static pointInOpPolygon(pt: IPoint64, op: OutPt): PointInPolygonResult {
    if (op === op.next || op.prev === op.next)
      return PointInPolygonResult.IsOutside;

    let op2 = op;
    do {
      if (op.pt.y !== pt.y) break;
      op = op.next!;
    } while (op !== op2);
    if (op.pt.y === pt.y)  // not a proper polygon
      return PointInPolygonResult.IsOutside;

    let isAbove = op.pt.y < pt.y
    const startingAbove = isAbove;
    let val = 0;

    op2 = op.next!;
    while (op2 !== op) {
      if (isAbove)
        while (op2 !== op && op2.pt.y < pt.y) op2 = op2.next!;
      else
        while (op2 !== op && op2.pt.y > pt.y) op2 = op2.next!;
      if (op2 === op) break;

      if (op2.pt.y === pt.y) {
        if (op2.pt.x === pt.x || (op2.pt.y === op2.prev.pt.y &&
          (pt.x < op2.prev.pt.x) !== (pt.x < op2.pt.x)))
          return PointInPolygonResult.IsOn;
        op2 = op2.next!;
        if (op2 === op) break;
        continue;
      }

      if (op2.pt.x <= pt.x || op2.prev.pt.x <= pt.x) {
        if (op2.prev.pt.x < pt.x && op2.pt.x < pt.x)
          val = 1 - val;
        else {
          const d = InternalClipper.crossProduct(op2.prev.pt, op2.pt, pt);
          if (d === 0) return PointInPolygonResult.IsOn;
          if ((d < 0) === isAbove) val = 1 - val;
        }
      }
      isAbove = !isAbove;
      op2 = op2.next!;
    }

    if (isAbove !== startingAbove) {
      const d = InternalClipper.crossProduct(op2.prev.pt, op2.pt, pt);
      if (d === 0) return PointInPolygonResult.IsOn;
      if ((d < 0) === isAbove) val = 1 - val;
    }

    if (val === 0) return PointInPolygonResult.IsOutside;
    else return PointInPolygonResult.IsInside;
  }

  private static path1InsidePath2(op1: OutPt, op2: OutPt): boolean {
    let result: PointInPolygonResult;
    let outside_cnt = 0;
    let op = op1;
    do {
      result = this.pointInOpPolygon(op.pt, op2);
      if (result === PointInPolygonResult.IsOutside) ++outside_cnt;
      else if (result === PointInPolygonResult.IsInside) --outside_cnt;
      op = op.next!;
    } while (op !== op1 && Math.abs(outside_cnt) < 2);
    if (Math.abs(outside_cnt) > 1) return (outside_cnt < 0);

    const mp = ClipperBase.getBoundsPath(this.getCleanPath(op1)).midPoint();
    const path2 = this.getCleanPath(op2);
    return InternalClipper.pointInPolygon(mp, path2) !== PointInPolygonResult.IsOutside;
  }

  private moveSplits(fromOr: OutRec, toOr: OutRec): void {
    if (!fromOr.splits) return;
    toOr.splits = toOr.splits || [];
    for (const i of fromOr.splits) {
      toOr.splits.push(i);
    }
    fromOr.splits = undefined;
  }

  private processHorzJoins(): void {
    for (const j of this._horzJoinList) {
      const or1 = ClipperBase.getRealOutRec(j.op1!.outrec)!;
      let or2 = ClipperBase.getRealOutRec(j.op2!.outrec)!;

      const op1b = j.op1!.next!;
      const op2b = j.op2!.prev!;
      j.op1!.next = j.op2!;
      j.op2!.prev = j.op1!;
      op1b.prev = op2b;
      op2b.next = op1b;

      if (or1 === or2) {
        or2 = this.newOutRec();
        or2.pts = op1b;
        ClipperBase.fixOutRecPts(or2);

        if (or1.pts!.outrec === or2) {
          or1.pts = j.op1;
          or1.pts!.outrec = or1;
        }

        if (this._using_polytree) {
          if (ClipperBase.path1InsidePath2(or1.pts!, or2.pts)) {
            const tmp = or1.pts;
            or1.pts = or2.pts;
            or2.pts = tmp;
            ClipperBase.fixOutRecPts(or1);
            ClipperBase.fixOutRecPts(or2);
            or2.owner = or1;
          } else if (ClipperBase.path1InsidePath2(or2.pts, or1.pts!)) {
            or2.owner = or1;
          } else {
            or2.owner = or1.owner;
          }

          or1.splits = or1.splits || [];
          or1.splits.push(or2.idx);
        } else {
          or2.owner = or1;
        }
      } else {
        or2.pts = undefined;
        if (this._using_polytree) {
          ClipperBase.setOwner(or2, or1);
          this.moveSplits(or2, or1);
        } else {
          or2.owner = or1;
        }
      }
    }
  }

  private static ptsReallyClose(pt1: IPoint64, pt2: IPoint64): boolean {
    return (Math.abs(pt1.x - pt2.x) < 2) && (Math.abs(pt1.y - pt2.y) < 2);
  }

  private static isVerySmallTriangle(op: OutPt): boolean {
    return op.next!.next === op.prev &&
      (this.ptsReallyClose(op.prev.pt, op.next!.pt) ||
        this.ptsReallyClose(op.pt, op.next!.pt) ||
        this.ptsReallyClose(op.pt, op.prev.pt));
  }


  private static isValidClosedPath(op: OutPt | undefined): boolean {
    return op !== undefined && op.next !== op &&
      (op.next !== op.prev || !this.isVerySmallTriangle(op));
  }

  private static disposeOutPt(op: OutPt): OutPt | undefined {
    const result = op.next === op ? undefined : op.next;
    op.prev.next = op.next;
    op.next!.prev = op.prev;
    return result;
  }

  private cleanCollinear(outrec: OutRec | undefined): void {
    outrec = ClipperBase.getRealOutRec(outrec);

    if (outrec === undefined || outrec.isOpen) return;

    if (!ClipperBase.isValidClosedPath(outrec.pts)) {
      outrec.pts = undefined;
      return;
    }

    let startOp: OutPt = outrec.pts!;
    let op2: OutPt | undefined = startOp;
    for (; ;) {
      // NB if preserveCollinear == true, then only remove 180 deg. spikes
      if (InternalClipper.crossProduct(op2!.prev.pt, op2!.pt, op2!.next!.pt) === 0 &&
        (op2!.pt === op2!.prev.pt || op2!.pt === op2!.next!.pt || !this.preserveCollinear ||
          InternalClipper.dotProduct(op2!.prev.pt, op2!.pt, op2!.next!.pt) < 0)) {

        if (op2 === outrec.pts) {
          outrec.pts = op2!.prev;
        }

        op2 = ClipperBase.disposeOutPt(op2!);
        if (!ClipperBase.isValidClosedPath(op2)) {
          outrec.pts = undefined;
          return;
        }
        startOp = op2!;
        continue;
      }
      op2 = op2!.next;
      if (op2 === startOp) break;
    }
    this.fixSelfIntersects(outrec);
  }

  private doSplitOp(outrec: OutRec, splitOp: OutPt): void {
    // splitOp.prev <=> splitOp &&
    // splitOp.next <=> splitOp.next.next are intersecting
    const prevOp: OutPt = splitOp.prev;
    const nextNextOp: OutPt = splitOp.next!.next!;
    outrec.pts = prevOp;

    const ip: IPoint64 = InternalClipper.getIntersectPoint(
      prevOp.pt, splitOp.pt, splitOp.next!.pt, nextNextOp.pt).ip;

    const area1: number = ClipperBase.area(prevOp);
    const absArea1: number = Math.abs(area1);

    if (absArea1 < 2) {
      outrec.pts = undefined;
      return;
    }

    const area2: number = ClipperBase.areaTriangle(ip, splitOp.pt, splitOp.next!.pt);
    const absArea2: number = Math.abs(area2);

    // de-link splitOp and splitOp.next from the path
    // while inserting the intersection point
    if (ip === prevOp.pt || ip === nextNextOp.pt) {
      nextNextOp.prev = prevOp;
      prevOp.next = nextNextOp;
    } else {
      const newOp2 = new OutPt(ip, outrec);
      newOp2.prev = prevOp;
      newOp2.next = nextNextOp;
      nextNextOp.prev = newOp2;
      prevOp.next = newOp2;
    }

    // nb: area1 is the path's area *before* splitting, whereas area2 is
    // the area of the triangle containing splitOp & splitOp.next.
    // So the only way for these areas to have the same sign is if
    // the split triangle is larger than the path containing prevOp or
    // if there's more than one self=intersection.
    if (absArea2 > 1 &&
      (absArea2 > absArea1 || (area2 > 0) === (area1 > 0))) {

      const newOutRec: OutRec = this.newOutRec();
      newOutRec.owner = outrec.owner;
      splitOp.outrec = newOutRec;
      splitOp.next!.outrec = newOutRec;

      const newOp: OutPt = new OutPt(ip, newOutRec);
      newOp.prev = splitOp.next!;
      newOp.next = splitOp;
      newOutRec.pts = newOp;
      splitOp.prev = newOp;
      splitOp.next!.next = newOp;

      if (this._using_polytree) {
        if (ClipperBase.path1InsidePath2(prevOp, newOp)) {
          newOutRec.splits = newOutRec.splits || [];
          newOutRec.splits.push(outrec.idx);
        } else {
          outrec.splits = outrec.splits || [];
          outrec.splits.push(newOutRec.idx);
        }
      }
    }
    // else { splitOp = undefined; splitOp.next = undefined; }
  }

  private fixSelfIntersects(outrec: OutRec): void {
    let op2: OutPt = outrec.pts!;
    for (; ;) {
      if (op2.prev === op2.next!.next) break;
      if (InternalClipper.segsIntersect(op2.prev.pt, op2.pt, op2.next!.pt, op2.next!.next!.pt)) {
        this.doSplitOp(outrec, op2);
        if (!outrec.pts) return;
        op2 = outrec.pts;
        continue;
      } else {
        op2 = op2.next!;
      }
      if (op2 === outrec.pts) break;
    }
  }

  static buildPath(op: OutPt | undefined, reverse: boolean, isOpen: boolean, path: Path64): boolean {
    if (op === undefined || op.next === op || (!isOpen && op.next === op.prev)) return false;
    path.length = 0

    let lastPt: IPoint64;
    let op2: OutPt;
    if (reverse) {
      lastPt = op.pt;
      op2 = op.prev;
    } else {
      op = op.next!;
      lastPt = op.pt;
      op2 = op.next!;
    }
    path.push(lastPt);

    while (op2 !== op) {
      if (op2.pt !== lastPt) {
        lastPt = op2.pt;
        path.push(lastPt);
      }
      if (reverse) {
        op2 = op2.prev;
      } else {
        op2 = op2.next!;
      }
    }

    if (path.length === 3 && this.isVerySmallTriangle(op2)) return false;
    else return true;
  }

  protected buildPaths(solutionClosed: Paths64, solutionOpen: Paths64): boolean {
    solutionClosed.length = 0
    solutionOpen.length = 0

    let i = 0;
    while (i < this._outrecList.length) {
      const outrec = this._outrecList[i++];
      if (!outrec.pts) continue;

      const path = new Path64();
      if (outrec.isOpen) {
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, path)) {
          solutionOpen.push(path);
        }
      } else {
        this.cleanCollinear(outrec);
        // closed paths should always return a Positive orientation
        // except when reverseSolution == true
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, path)) {
          solutionClosed.push(path);
        }
      }
    }
    return true;
  }

  private static getBoundsPath(path: Path64): Rect64 {
    if (path.length === 0) return new Rect64();
    const result = Clipper.InvalidRect64;
    for (const pt of path) {
      if (pt.x < result.left) result.left = pt.x;
      if (pt.x > result.right) result.right = pt.x;
      if (pt.y < result.top) result.top = pt.y;
      if (pt.y > result.bottom) result.bottom = pt.y;
    }
    return result;
  }

  private checkBounds(outrec: OutRec): boolean {
    if (outrec.pts === undefined) return false;
    if (!outrec.bounds.isEmpty()) return true;
    this.cleanCollinear(outrec);
    if (outrec.pts === undefined || !ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, outrec.path))
      return false;
    outrec.bounds = ClipperBase.getBoundsPath(outrec.path);
    return true;
  }

  private checkSplitOwner(outrec: OutRec, splits: number[] | undefined): boolean {
    for (const i of splits!) {
      const split: OutRec | undefined = ClipperBase.getRealOutRec(this._outrecList[i]);
      if (split === undefined || split === outrec || split.recursiveSplit === outrec) continue;
      split.recursiveSplit = outrec; //#599
      if (split!.splits !== undefined && this.checkSplitOwner(outrec, split.splits)) return true;
      if (ClipperBase.isValidOwner(outrec, split) &&
        this.checkBounds(split) &&
        split.bounds.containsRect(outrec.bounds) &&
        ClipperBase.path1InsidePath2(outrec.pts!, split.pts!)) {
        outrec.owner = split; //found in split
        return true;
      }
    }
    return false;
  }

  private recursiveCheckOwners(outrec: OutRec, polypath: PolyPathBase): void {
    // pre-condition: outrec will have valid bounds
    // post-condition: if a valid path, outrec will have a polypath

    if (outrec.polypath !== undefined || outrec.bounds.isEmpty()) return;

    while (outrec.owner !== undefined) {
      if (outrec.owner.splits !== undefined &&
        this.checkSplitOwner(outrec, outrec.owner.splits)) break;
      else if (outrec.owner.pts !== undefined && this.checkBounds(outrec.owner) &&
        ClipperBase.path1InsidePath2(outrec.pts!, outrec.owner.pts!)) break;
      outrec.owner = outrec.owner.owner;
    }

    if (outrec.owner !== undefined) {
      if (outrec.owner.polypath === undefined)
        this.recursiveCheckOwners(outrec.owner, polypath);
      outrec.polypath = outrec.owner.polypath!.addChild(outrec.path);
    } else {
      outrec.polypath = polypath.addChild(outrec.path);
    }
  }

  protected buildTree(polytree: PolyPathBase, solutionOpen: Paths64): void {
    polytree.clear();
    solutionOpen.length = 0

    let i = 0;
    while (i < this._outrecList.length) {
      const outrec: OutRec = this._outrecList[i++];
      if (outrec.pts === undefined) continue;

      if (outrec.isOpen) {
        const open_path = new Path64();
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, open_path))
          solutionOpen.push(open_path);
        continue;
      }
      if (this.checkBounds(outrec))
        this.recursiveCheckOwners(outrec, polytree);
    }
  }

  public getBounds(): Rect64 {
    const bounds = Clipper.InvalidRect64;
    for (const t of this._vertexList) {
      let v = t;
      do {
        if (v.pt.x < bounds.left) bounds.left = v.pt.x;
        if (v.pt.x > bounds.right) bounds.right = v.pt.x;
        if (v.pt.y < bounds.top) bounds.top = v.pt.y;
        if (v.pt.y > bounds.bottom) bounds.bottom = v.pt.y;
        v = v.next!;
      } while (v !== t);
    }
    return bounds.isEmpty() ? new Rect64(0, 0, 0, 0) : bounds;
  }

}


export class Clipper64 extends ClipperBase {

  override addPath(path: Path64, polytype: PathType, isOpen: boolean = false): void {
    super.addPath(path, polytype, isOpen);
  }

  addReusableData(reusableData: ReuseableDataContainer64): void {
    super.addReuseableData(reusableData);
  }

  override addPaths(paths: Paths64, polytype: PathType, isOpen: boolean = false): void {
    super.addPaths(paths, polytype, isOpen);
  }

  addSubjectPaths(paths: Paths64): void {
    this.addPaths(paths, PathType.Subject);
  }

  addOpenSubjectPaths(paths: Paths64): void {
    this.addPaths(paths, PathType.Subject, true);
  }

  addClipPaths(paths: Paths64): void {
    this.addPaths(paths, PathType.Clip);
  }

  execute(clipType: ClipType, fillRule: FillRule, solutionClosed: Paths64, solutionOpen = new Paths64()): boolean {
    solutionClosed.length = 0
    solutionOpen.length = 0
    try {
      this.executeInternal(clipType, fillRule);
      this.buildPaths(solutionClosed, solutionOpen);
    } catch (error) {
      this._succeeded = false;
    }

    this.clearSolutionOnly();
    return this._succeeded;
  }


  executePolyTree(clipType: ClipType, fillRule: FillRule, polytree: PolyTree64, openPaths = new Paths64()): boolean {
    polytree.clear();
    openPaths.length = 0
    this._using_polytree = true;
    try {
      this.executeInternal(clipType, fillRule);
      this.buildTree(polytree, openPaths);
    } catch (error) {
      this._succeeded = false;
    }

    this.clearSolutionOnly();
    return this._succeeded;
  }

}

export abstract class PolyPathBase {
  protected _parent?: PolyPathBase;
  children: Array<PolyPathBase> = [];
  public polygon?: Path64;

  get isHole(): boolean {
    return this.getIsHole();
  }

  constructor(parent?: PolyPathBase) {
    this._parent = parent;
  }

  private getLevel(): number {
    let result = 0;
    let pp: PolyPathBase | undefined = this._parent;
    while (pp !== undefined) {
      ++result;
      pp = pp._parent;
    }
    return result;
  }

  get level(): number {
    return this.getLevel();
  }

  private getIsHole(): boolean {
    const lvl = this.getLevel();
    return lvl !== 0 && (lvl & 1) === 0;
  }

  get count(): number {
    return this.children.length;
  }

  abstract addChild(p: Path64): PolyPathBase;

  clear(): void {
    this.children.length = 0
  }

  forEach = this.children.forEach

  private toStringInternal(idx: number, level: number): string {
    let result = "", padding = "", plural = "s";
    if (this.children.length === 1) plural = "";
    padding = padding.padStart(level * 2);
    if ((level & 1) === 0)
      result += `${padding}+- hole (${idx}) contains ${this.children.length} nested polygon${plural}.\n`;
    else
      result += `${padding}+- polygon (${idx}) contains ${this.children.length} hole${plural}.\n`;

    for (let i = 0; i < this.children.length; i++)
      if (this.children[i].children.length > 0)
        result += this.children[i].toStringInternal(i, level + 1);
    return result;
  }

  toString(): string {
    if (this.level > 0) return ""; //only accept tree root 
    let plural = "s";
    if (this.children.length === 1) plural = "";
    let result = `Polytree with ${this.children.length} polygon${plural}.\n`;
    for (let i = 0; i < this.children.length; i++)
      if (this.children[i].children.length > 0)
        result += this.children[i].toStringInternal(i, 1);
    return result + '\n';
  }

} // end of PolyPathBase class

export class PolyPath64 extends PolyPathBase {

  constructor(parent?: PolyPathBase) {
    super(parent);
  }

  addChild(p: Path64): PolyPathBase {
    const newChild = new PolyPath64(this);
    (newChild as PolyPath64).polygon = p;
    this.children.push(newChild);
    return newChild;
  }

  get(index: number): PolyPath64 {
    if (index < 0 || index >= this.children.length) {
      throw new Error("InvalidOperationException");
    }
    return this.children[index] as PolyPath64;
  }

  child(index: number): PolyPath64 {
    if (index < 0 || index >= this.children.length) {
      throw new Error("InvalidOperationException");
    }
    return this.children[index] as PolyPath64;
  }

  area(): number {
    let result = this.polygon ? Clipper.area(this.polygon) : 0;
    for (const polyPathBase of this.children) {
      const child = polyPathBase as PolyPath64;
      result += child.area();
    }
    return result;
  }
}


export class PolyTree64 extends PolyPath64 { }


export class ClipperLibException extends Error {
  constructor(description: string) {
    super(description);
  }
}
