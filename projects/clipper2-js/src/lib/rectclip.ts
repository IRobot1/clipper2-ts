/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  8 September 2023                                                  *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2023                                         *
* Purpose   :  FAST rectangular clipping                                       *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/

//
// Converted from C# implemention https://github.com/AngusJohnson/Clipper2/blob/main/CSharp/Clipper2Lib/Clipper.Core.cs
// Removed support for USINGZ
//
// Converted by ChatGPT 4 August 3 version https://help.openai.com/en/articles/6825453-chatgpt-release-notes
//

import { Clipper } from "./clipper";
import { IPoint64, InternalClipper, Path64, Paths64, Point64, Rect64 } from "./core";
import { PointInPolygonResult } from "./engine";

export class OutPt2 {
  next?: OutPt2;
  prev?: OutPt2;

  pt: IPoint64;
  ownerIdx: number;
  edge?: Array<OutPt2 | undefined>;

  constructor(pt: IPoint64) {
    this.pt = pt;
    this.ownerIdx = 0
  }
}

enum Location {
  left, top, right, bottom, inside
}

export class RectClip64 {
  protected rect: Rect64;
  protected mp: Point64;
  protected rectPath: Path64;
  protected pathBounds!: Rect64;
  protected results: Array<OutPt2 | undefined>
  protected edges: Array<OutPt2 | undefined>[];
  protected currIdx = -1;

  constructor(rect: Rect64) {
    this.rect = rect;
    this.mp = rect.midPoint();
    this.rectPath = rect.asPath();
    this.results = [];
    this.edges = Array(8).fill(undefined).map(() => []);
  }

  protected add(pt: IPoint64, startingNewPath: boolean = false): OutPt2 {
    let currIdx = this.results.length;
    let result: OutPt2;
    if (currIdx === 0 || startingNewPath) {
      result = new OutPt2(pt);
      this.results.push(result);
      result.ownerIdx = currIdx;
      result.prev = result;
      result.next = result;
    } else {
      currIdx--;
      const prevOp = this.results[currIdx];
      if (prevOp!.pt === pt) return prevOp!;
      result = new OutPt2(pt);
      result.ownerIdx = currIdx;
      result.next = prevOp!.next;
      prevOp!.next!.prev = result;
      prevOp!.next = result;
      result.prev = prevOp!;
      this.results[currIdx] = result;
    }
    return result;
  }

  private static path1ContainsPath2(path1: Path64, path2: Path64): boolean {
    let ioCount = 0;
    for (const pt of path2) {
      const pip = InternalClipper.pointInPolygon(pt, path1);
      switch (pip) {
        case PointInPolygonResult.IsInside:
          ioCount--; break;
        case PointInPolygonResult.IsOutside:
          ioCount++; break;
      }
      if (Math.abs(ioCount) > 1) break;
    }
    return ioCount <= 0;
  }

  private static isClockwise(prev: Location, curr: Location, prevPt: IPoint64, currPt: IPoint64, rectMidPoint: Point64): boolean {
    if (this.areOpposites(prev, curr))
      return InternalClipper.crossProduct(prevPt, rectMidPoint, currPt) < 0;
    else
      return this.headingClockwise(prev, curr);
  }

  private static areOpposites(prev: Location, curr: Location): boolean {
    return Math.abs(prev - curr) === 2;
  }

  private static headingClockwise(prev: Location, curr: Location): boolean {
    return (prev + 1) % 4 === curr;
  }

  private static getAdjacentLocation(loc: Location, isClockwise: boolean): Location {
    const delta = isClockwise ? 1 : 3;
    return (loc + delta) % 4;
  }

  private static unlinkOp(op: OutPt2 | undefined): OutPt2 | undefined {
    if (op!.next === op) return undefined;
    op!.prev!.next = op!.next;
    op!.next!.prev = op!.prev;
    return op!.next;
  }

  private static unlinkOpBack(op: OutPt2 | undefined): OutPt2 | undefined {
    if (op!.next === op) return undefined;
    op!.prev!.next = op!.next;
    op!.next!.prev = op!.prev;
    return op!.prev;
  }

  private static getEdgesForPt(pt: IPoint64, rec: Rect64): number {
    let result = 0;
    if (pt.x === rec.left) result = 1;
    else if (pt.x === rec.right) result = 4;
    if (pt.y === rec.top) result += 2;
    else if (pt.y === rec.bottom) result += 8;
    return result;
  }

  private static isHeadingClockwise(pt1: IPoint64, pt2: IPoint64, edgeIdx: number): boolean {
    switch (edgeIdx) {
      case 0: return pt2.y < pt1.y;
      case 1: return pt2.x > pt1.x;
      case 2: return pt2.y > pt1.y;
      default: return pt2.x < pt1.x;
    }
  }

  private static hasHorzOverlap(left1: IPoint64, right1: IPoint64, left2: IPoint64, right2: IPoint64): boolean {
    return (left1.x < right2.x) && (right1.x > left2.x);
  }

  private static hasVertOverlap(top1: IPoint64, bottom1: IPoint64, top2: IPoint64, bottom2: IPoint64): boolean {
    return (top1.y < bottom2.y) && (bottom1.y > top2.y);
  }

  private static addToEdge(edge: (OutPt2 | undefined)[], op: OutPt2): void {
    if (op.edge) return;
    op.edge = edge;
    edge.push(op);
  }

  private static uncoupleEdge(op: OutPt2): void {
    if (!op.edge) return;
    for (let i = 0; i < op.edge.length; i++) {
      const op2 = op.edge[i];
      if (op2 === op) {
        op.edge[i] = undefined;
        break;
      }
    }
    op.edge = undefined;
  }

  private static setNewOwner(op: OutPt2, newIdx: number): void {
    op.ownerIdx = newIdx;
    let op2 = op.next!;
    while (op2 !== op) {
      op2.ownerIdx = newIdx;
      op2 = op2.next!;
    }
  }

  private addCorner(prev: Location, curr: Location): void {
    if (RectClip64.headingClockwise(prev, curr))
      this.add(this.rectPath[prev]);
    else
      this.add(this.rectPath[curr]);
  }

  private addCornerByRef(loc: Location, isClockwise: boolean): void {
    if (isClockwise) {
      this.add(this.rectPath[loc]);
      loc = RectClip64.getAdjacentLocation(loc, true);
    } else {
      loc = RectClip64.getAdjacentLocation(loc, false);
      this.add(this.rectPath[loc]);
    }
  }

  protected static getLocation(rec: Rect64, pt: IPoint64): { success: boolean, loc: Location } {
    let loc: Location;

    if (pt.x === rec.left && pt.y >= rec.top && pt.y <= rec.bottom) {
      loc = Location.left; // pt on rec
      return { success: false, loc }
    }
    if (pt.x === rec.right && pt.y >= rec.top && pt.y <= rec.bottom) {
      loc = Location.right; // pt on rec
      return { success: false, loc };
    }
    if (pt.y === rec.top && pt.x >= rec.left && pt.x <= rec.right) {
      loc = Location.top; // pt on rec
      return { success: false, loc };
    }
    if (pt.y === rec.bottom && pt.x >= rec.left && pt.x <= rec.right) {
      loc = Location.bottom; // pt on rec
      return { success: false, loc };
    }
    if (pt.x < rec.left) loc = Location.left;
    else if (pt.x > rec.right) loc = Location.right;
    else if (pt.y < rec.top) loc = Location.top;
    else if (pt.y > rec.bottom) loc = Location.bottom;
    else loc = Location.inside;

    return { success: true, loc };
  }

  private static isHorizontal(pt1: IPoint64, pt2: IPoint64): boolean {
    return pt1.y == pt2.y;
  }

  private static getSegmentIntersection(p1: IPoint64, p2: IPoint64, p3: IPoint64, p4: IPoint64): { success: boolean, ip: IPoint64 } {
    let res1 = InternalClipper.crossProduct(p1, p3, p4);
    let res2 = InternalClipper.crossProduct(p2, p3, p4);
    let ip: IPoint64 = new Point64(0, 0);

    const equals = (lhs: IPoint64, rhs: IPoint64): boolean => {
      return lhs.x === rhs.x && lhs.y === rhs.y;
    }

    if (res1 === 0) {
      ip = p1;
      if (res2 === 0) return { ip, success: false };
      else if (equals(p1, p3) || equals(p1, p4)) return { ip, success: true };
      else if (RectClip64.isHorizontal(p3, p4)) return { ip, success: ((p1.x > p3.x) === (p1.x < p4.x)) };
      else return { ip, success: ((p1.y > p3.y) === (p1.y < p4.y)) };
    }
    else if (res2 === 0) {
      ip = p2;
      if (equals(p2, p3) || equals(p2, p4)) return { ip, success: true };
      else if (RectClip64.isHorizontal(p3, p4)) return { ip, success: ((p2.x > p3.x) === (p2.x < p4.x)) };
      else return { ip, success: ((p2.y > p3.y) === (p2.y < p4.y)) };
    }

    if ((res1 > 0) === (res2 > 0)) return { ip: new Point64(0, 0), success: false };

    let res3 = InternalClipper.crossProduct(p3, p1, p2);
    let res4 = InternalClipper.crossProduct(p4, p1, p2);

    if (res3 === 0) {
      ip = p3;
      if (equals(p3, p1) || equals(p3, p2)) return { ip, success: true };
      else if (RectClip64.isHorizontal(p1, p2)) return { ip, success: ((p3.x > p1.x) === (p3.x < p2.x)) };
      else return { ip, success: ((p3.y > p1.y) === (p3.y < p2.y)) };
    }
    else if (res4 === 0) {
      ip = p4;
      if (equals(p4, p1) || equals(p4, p2)) return { ip, success: true };
      else if (RectClip64.isHorizontal(p1, p2)) return { ip, success: ((p4.x > p1.x) === (p4.x < p2.x)) };
      else return { ip, success: ((p4.y > p1.y) === (p4.y < p2.y)) };
    }

    if ((res3 > 0) === (res4 > 0)) return { ip: new Point64(0, 0), success: false };

    return InternalClipper.getIntersectPoint(p1, p2, p3, p4);
  }

  protected static getIntersection(rectPath: Path64, p: IPoint64, p2: IPoint64, loc: Location): { success: boolean, loc: Location, ip: IPoint64 } {
    // gets the pt of intersection between rectPath and segment(p, p2) that's closest to 'p'
    // when result == false, loc will remain unchanged
    let ip: IPoint64 = new Point64();
    let result: { success: boolean, ip: IPoint64 }

    switch (loc) {
      case Location.left:
        if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[3])).success)
          return { success: true, loc, ip: result.ip }
        else if (p.y < rectPath[0].y && (result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[1])).success) {
          loc = Location.top;
          return { success: true, loc, ip: result.ip }
        }
        else if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[2], rectPath[3])).success) {
          loc = Location.bottom;
          return { success: true, loc, ip: result.ip }
        }
        else return { success: false, loc, ip }

      case Location.right:
        if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[1], rectPath[2])).success)
          return { success: true, loc, ip: result.ip }
        else if (p.y < rectPath[0].y && (result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[1])).success) {
          loc = Location.top;
          return { success: true, loc, ip: result.ip }
        }
        else if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[2], rectPath[3])).success) {
          loc = Location.bottom;
          return { success: true, loc, ip: result.ip }
        }
        else return { success: false, loc, ip }

      case Location.top:
        if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[1])).success)
          return { success: true, loc, ip: result.ip }
        else if (p.x < rectPath[0].x && (result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[3])).success) {
          loc = Location.left;
          return { success: true, loc, ip: result.ip }
        }
        else if (p.x > rectPath[1].x && (result = RectClip64.getSegmentIntersection(p, p2, rectPath[1], rectPath[2])).success) {
          loc = Location.right;
          return { success: true, loc, ip: result.ip }
        }
        else return { success: false, loc, ip }

      case Location.bottom:
        if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[2], rectPath[3])).success)
          return { success: true, loc, ip: result.ip }
        else if (p.x < rectPath[3].x && (result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[3])).success) {
          loc = Location.left;
          return { success: true, loc, ip: result.ip }
        }
        else if (p.x > rectPath[2].x && (result = RectClip64.getSegmentIntersection(p, p2, rectPath[1], rectPath[2])).success) {
          loc = Location.right;
          return { success: true, loc, ip: result.ip }
        }
        else return { success: false, loc, ip }

      default:
        if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[3])).success) {
          loc = Location.left;
          return { success: true, loc, ip: result.ip }
        }
        else if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[0], rectPath[1])).success) {
          loc = Location.top;
          return { success: true, loc, ip: result.ip }
        }
        else if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[1], rectPath[2])).success) {
          loc = Location.right;
          return { success: true, loc, ip: result.ip }
        }
        else if ((result = RectClip64.getSegmentIntersection(p, p2, rectPath[2], rectPath[3])).success) {
          loc = Location.bottom;
          return { success: true, loc, ip: result.ip }
        }
        else return { success: false, loc, ip }
    }
  }

  protected getNextLocation(path: Path64, context: { loc: Location, i: number, highI: number }): void {

    switch (context.loc) {
      case Location.left:
        while (context.i <= context.highI && path[context.i].x <= this.rect.left) context.i++;
        if (context.i > context.highI) break;
        if (path[context.i].x >= this.rect.right) context.loc = Location.right;
        else if (path[context.i].y <= this.rect.top) context.loc = Location.top;
        else if (path[context.i].y >= this.rect.bottom) context.loc = Location.bottom;
        else context.loc = Location.inside;
        break;

      case Location.top:
        while (context.i <= context.highI && path[context.i].y <= this.rect.top) context.i++;
        if (context.i > context.highI) break;
        if (path[context.i].y >= this.rect.bottom) context.loc = Location.bottom;
        else if (path[context.i].x <= this.rect.left) context.loc = Location.left;
        else if (path[context.i].x >= this.rect.right) context.loc = Location.right;
        else context.loc = Location.inside;
        break;

      case Location.right:
        while (context.i <= context.highI && path[context.i].x >= this.rect.right) context.i++;
        if (context.i > context.highI) break;
        if (path[context.i].x <= this.rect.left) context.loc = Location.left;
        else if (path[context.i].y <= this.rect.top) context.loc = Location.top;
        else if (path[context.i].y >= this.rect.bottom) context.loc = Location.bottom;
        else context.loc = Location.inside;
        break;

      case Location.bottom:
        while (context.i <= context.highI && path[context.i].y >= this.rect.bottom) context.i++;
        if (context.i > context.highI) break;
        if (path[context.i].y <= this.rect.top) context.loc = Location.top;
        else if (path[context.i].x <= this.rect.left) context.loc = Location.left;
        else if (path[context.i].x >= this.rect.right) context.loc = Location.right;
        else context.loc = Location.inside;
        break;

      case Location.inside:
        while (context.i <= context.highI) {
          if (path[context.i].x < this.rect.left) context.loc = Location.left;
          else if (path[context.i].x > this.rect.right) context.loc = Location.right;
          else if (path[context.i].y > this.rect.bottom) context.loc = Location.bottom;
          else if (path[context.i].y < this.rect.top) context.loc = Location.top;
          else {
            this.add(path[context.i]);
            context.i++;
            continue;
          }
          break;
        }
        break;
    }
  }

  protected executeInternal(path: Path64): void {
    if (path.length < 3 || this.rect.isEmpty()) return;
    const startLocs: Location[] = [];

    let firstCross: Location = Location.inside;
    let crossingLoc: Location = firstCross, prev: Location = firstCross;

    let i: number
    const highI = path.length - 1;
    let result = RectClip64.getLocation(this.rect, path[highI])
    let loc: Location = result.loc
    if (!result.success) {
      i = highI - 1;
      while (i >= 0 && !result.success) {
        i--
        result = RectClip64.getLocation(this.rect, path[i])
        prev = result.loc
      }
      if (i < 0) {
        for (const pt of path) {
          this.add(pt);
        }
        return;
      }
      if (prev == Location.inside) loc = Location.inside;
    }
    const startingLoc = loc;

    ///////////////////////////////////////////////////
    i = 0;
    while (i <= highI) {
      prev = loc;
      const prevCrossLoc: Location = crossingLoc;
      this.getNextLocation(path, { loc, i, highI });
      if (i > highI) break;

      const prevPt = (i == 0) ? path[highI] : path[i - 1];
      crossingLoc = loc;

      let result = RectClip64.getIntersection(this.rectPath, path[i], prevPt, crossingLoc)
      const ip: IPoint64 = result.ip

      if (!result.success) {
        if (prevCrossLoc == Location.inside) {
          const isClockw = RectClip64.isClockwise(prev, loc, prevPt, path[i], this.mp);
          do {
            startLocs.push(prev);
            prev = RectClip64.getAdjacentLocation(prev, isClockw);
          } while (prev != loc);
          crossingLoc = prevCrossLoc;
        } else if (prev != Location.inside && prev != loc) {
          const isClockw = RectClip64.isClockwise(prev, loc, prevPt, path[i], this.mp);
          do {
            this.addCornerByRef(prev, isClockw);
          } while (prev != loc);
        }
        ++i;
        continue;
      }

      ////////////////////////////////////////////////////
      // we must be crossing the rect boundary to get here
      ////////////////////////////////////////////////////
      if (loc == Location.inside) {
        if (firstCross == Location.inside) {
          firstCross = crossingLoc;
          startLocs.push(prev);
        } else if (prev != crossingLoc) {
          const isClockw = RectClip64.isClockwise(prev, crossingLoc, prevPt, path[i], this.mp);
          do {
            this.addCornerByRef(prev, isClockw);
          } while (prev != crossingLoc);
        }
      } else if (prev != Location.inside) {
        // passing right through rect. 'ip' here will be the second
        // intersect pt but we'll also need the first intersect pt (ip2)

        loc = prev;
        result = RectClip64.getIntersection(this.rectPath, prevPt, path[i], loc);
        const ip2: IPoint64 = result.ip

        if (prevCrossLoc != Location.inside && prevCrossLoc != loc)
          this.addCorner(prevCrossLoc, loc);

        if (firstCross == Location.inside) {
          firstCross = loc;
          startLocs.push(prev);
        }

        loc = crossingLoc;
        this.add(ip2);
        if (ip == ip2) {
          loc = RectClip64.getLocation(this.rect, path[i]).loc;
          this.addCorner(crossingLoc, loc);
          crossingLoc = loc;
          continue;
        }
      } else {
        loc = crossingLoc;
        if (firstCross == Location.inside)
          firstCross = crossingLoc;
      }

      this.add(ip);
    }//while i <= highI
    ///////////////////////////////////////////////////

    if (firstCross == Location.inside) {
      if (startingLoc != Location.inside) {
        if (this.pathBounds.containsRect(this.rect) && RectClip64.path1ContainsPath2(path, this.rectPath)) {
          for (let j = 0; j < 4; j++) {
            this.add(this.rectPath[j]);
            RectClip64.addToEdge(this.edges[j * 2], this.results[0]!);
          }
        }
      }
    } else if (loc != Location.inside && (loc != firstCross || startLocs.length > 2)) {
      if (startLocs.length > 0) {
        prev = loc;
        for (const loc2 of startLocs) {
          if (prev == loc2) continue;
          this.addCornerByRef(prev, RectClip64.headingClockwise(prev, loc2));
          prev = loc2;
        }
        loc = prev;
      }
      if (loc != firstCross)
        this.addCornerByRef(loc, RectClip64.headingClockwise(loc, firstCross));
    }
  }

  public execute(paths: Paths64): Paths64 {
    const result: Paths64 = [];
    if (this.rect.isEmpty()) return result;

    for (const path of paths) {
      if (path.length < 3) continue;
      this.pathBounds = Clipper.getBounds(path);

      if (!this.rect.intersects(this.pathBounds)) continue;
      else if (this.rect.containsRect(this.pathBounds)) {
        result.push(path);
        continue;
      }
      this.executeInternal(path);
      this.checkEdges();
      for (let i = 0; i < 4; ++i)
        this.tidyEdgePair(i, this.edges[i * 2], this.edges[i * 2 + 1]);

      for (const op of this.results) {
        const tmp = this.getPath(op);
        if (tmp.length > 0) result.push(tmp);
      }

      this.results.length = 0
      for (let i = 0; i < 8; i++)
        this.edges[i].length = 0
    }
    return result;
  }

  private checkEdges(): void {
    for (let i = 0; i < this.results.length; i++) {
      let op = this.results[i];
      let op2 = op;

      if (op === undefined) continue;

      do {
        if (InternalClipper.crossProduct(op2!.prev!.pt, op2!.pt, op2!.next!.pt) === 0) {
          if (op2 === op) {
            op2 = RectClip64.unlinkOpBack(op2);
            if (op2 === undefined) break;
            op = op2.prev;
          } else {
            op2 = RectClip64.unlinkOpBack(op2);
            if (op2 === undefined) break;
          }
        } else {
          op2 = op2!.next;
        }
      } while (op2 !== op);

      if (op2 === undefined) {
        this.results[i] = undefined;
        continue;
      }
      this.results[i] = op2;

      let edgeSet1 = RectClip64.getEdgesForPt(op!.prev!.pt, this.rect);
      op2 = op;
      do {
        const edgeSet2 = RectClip64.getEdgesForPt(op2!.pt, this.rect);
        if (edgeSet2 !== 0 && op2!.edge === undefined) {
          const combinedSet = (edgeSet1 & edgeSet2);
          for (let j = 0; j < 4; ++j) {
            if ((combinedSet & (1 << j)) !== 0) {
              if (RectClip64.isHeadingClockwise(op2!.prev!.pt, op2!.pt, j))
                RectClip64.addToEdge(this.edges[j * 2], op2!);
              else
                RectClip64.addToEdge(this.edges[j * 2 + 1], op2!);
            }
          }
        }
        edgeSet1 = edgeSet2;
        op2 = op2!.next;
      } while (op2 !== op);
    }
  }

  private tidyEdgePair(idx: number, cw: Array<OutPt2 | undefined>, ccw: Array<OutPt2 | undefined>): void {
    if (ccw.length === 0) return;
    const isHorz = (idx === 1 || idx === 3);
    const cwIsTowardLarger = (idx === 1 || idx === 2);
    let i = 0, j = 0;
    let p1: OutPt2 | undefined, p2: OutPt2 | undefined, p1a: OutPt2 | undefined, p2a: OutPt2 | undefined, op: OutPt2 | undefined, op2: OutPt2 | undefined;

    while (i < cw.length) {
      p1 = cw[i];
      if (!p1 || p1.next === p1.prev) {
        cw[i++] = undefined;
        j = 0;
        continue;
      }

      const jLim = ccw.length;
      while (j < jLim && (!ccw[j] || ccw[j]!.next === ccw[j]!.prev)) ++j;

      if (j === jLim) {
        ++i;
        j = 0;
        continue;
      }

      if (cwIsTowardLarger) {
        p1 = cw[i]!.prev!;
        p1a = cw[i];
        p2 = ccw[j];
        p2a = ccw[j]!.prev!;
      } else {
        p1 = cw[i];
        p1a = cw[i]!.prev!;
        p2 = ccw[j]!.prev!;
        p2a = ccw[j];
      }

      if ((isHorz && !RectClip64.hasHorzOverlap(p1!.pt, p1a!.pt, p2!.pt, p2a!.pt)) ||
        (!isHorz && !RectClip64.hasVertOverlap(p1!.pt, p1a!.pt, p2!.pt, p2a!.pt))) {
        ++j;
        continue;
      }

      const isRejoining = cw[i]!.ownerIdx !== ccw[j]!.ownerIdx;

      if (isRejoining) {
        this.results[p2!.ownerIdx] = undefined;
        RectClip64.setNewOwner(p2!, p1!.ownerIdx);
      }

      if (cwIsTowardLarger) {
        // p1 >> | >> p1a;
        // p2 << | << p2a;
        p1!.next = p2;
        p2!.prev = p1;
        p1a!.prev = p2a;
        p2a!.next = p1a;
      } else {
        // p1 << | << p1a;
        // p2 >> | >> p2a;
        p1!.prev = p2;
        p2!.next = p1;
        p1a!.next = p2a;
        p2a!.prev = p1a;
      }

      if (!isRejoining) {
        const new_idx = this.results.length;
        this.results.push(p1a);
        RectClip64.setNewOwner(p1a!, new_idx);
      }

      if (cwIsTowardLarger) {
        op = p2;
        op2 = p1a;
      } else {
        op = p1;
        op2 = p2a;
      }
      this.results[op!.ownerIdx] = op;
      this.results[op2!.ownerIdx] = op2;

      // and now lots of work to get ready for the next loop

      let opIsLarger: boolean, op2IsLarger: boolean;
      if (isHorz) { // X
        opIsLarger = op!.pt.x > op!.prev!.pt.x;
        op2IsLarger = op2!.pt.x > op2!.prev!.pt.x;
      } else {      // Y
        opIsLarger = op!.pt.y > op!.prev!.pt.y;
        op2IsLarger = op2!.pt.y > op2!.prev!.pt.y;
      }

      if ((op!.next === op!.prev) || (op!.pt === op!.prev!.pt)) {
        if (op2IsLarger === cwIsTowardLarger) {
          cw[i] = op2;
          ccw[j++] = undefined;
        } else {
          ccw[j] = op2;
          cw[i++] = undefined;
        }
      } else if ((op2!.next === op2!.prev) || (op2!.pt === op2!.prev!.pt)) {
        if (opIsLarger === cwIsTowardLarger) {
          cw[i] = op;
          ccw[j++] = undefined;
        } else {
          ccw[j] = op;
          cw[i++] = undefined;
        }
      } else if (opIsLarger === op2IsLarger) {
        if (opIsLarger === cwIsTowardLarger) {
          cw[i] = op;
          RectClip64.uncoupleEdge(op2!);
          RectClip64.addToEdge(cw, op2!);
          ccw[j++] = undefined;
        } else {
          cw[i++] = undefined;
          ccw[j] = op2;
          RectClip64.uncoupleEdge(op!);
          RectClip64.addToEdge(ccw, op!);
          j = 0;
        }
      } else {
        if (opIsLarger === cwIsTowardLarger)
          cw[i] = op;
        else
          ccw[j] = op;

        if (op2IsLarger === cwIsTowardLarger)
          cw[i] = op2;
        else
          ccw[j] = op2;
      }
    }
  }

  protected getPath(op: OutPt2 | undefined): Path64 {
    const result = new Path64();
    if (!op || op.prev === op.next) return result;

    let op2: OutPt2 | undefined = op.next;
    while (op2 && op2 !== op) {
      if (InternalClipper.crossProduct(op2.prev!.pt, op2.pt, op2.next!.pt) === 0) {
        op = op2.prev!;
        op2 = RectClip64.unlinkOp(op2);
      } else {
        op2 = op2.next!;
      }
    }

    if (!op2) return new Path64();

    result.push(op.pt);
    op2 = op.next!;
    while (op2 !== op) {
      result.push(op2.pt);
      op2 = op2.next!;
    }

    return result;
  }
}

export class RectClipLines64 extends RectClip64 {

  constructor(rect: Rect64) {
    super(rect);
  }

  public override execute(paths: Paths64): Paths64 {
    const result = new Paths64();
    if (this.rect.isEmpty()) return result;
    for (const path of paths) {
      if (path.length < 2) continue;
      this.pathBounds = Clipper.getBounds(path);
      if (!this.rect.intersects(this.pathBounds)) continue;

      this.executeInternal(path);

      for (const op of this.results) {
        const tmp = this.getPath(op);
        if (tmp.length > 0) result.push(tmp);
      }

      // Clean up after every loop
      this.results.length = 0; // Clear the array
      for (let i = 0; i < 8; i++) {
        this.edges[i].length = 0; // Clear each array
      }
    }
    return result;
  }

  protected override getPath(op: OutPt2 | undefined): Path64 {
    const result = new Path64();
    if (!op || op === op.next) return result;
    op = op.next; // starting at path beginning 
    result.push(op!.pt);
    let op2 = op!.next!;
    while (op2 !== op) {
      result.push(op2.pt);
      op2 = op2.next!;
    }
    return result;
  }

  protected override  executeInternal(path: Path64): void {
    this.results = [];
    if (path.length < 2 || this.rect.isEmpty()) return;

    let prev: Location = Location.inside;
    let i = 1;
    const highI = path.length - 1;

    let result = RectClipLines64.getLocation(this.rect, path[0])
    let loc: Location = result.loc
    if (!result.success) {
      while (i <= highI && !result.success) {
        i++
        result = RectClipLines64.getLocation(this.rect, path[i])
        prev = result.loc
      }
      if (i > highI) {
        for (const pt of path) this.add(pt);
      }
      if (prev == Location.inside) loc = Location.inside;
      i = 1;
    }
    if (loc == Location.inside) this.add(path[0]);

    while (i <= highI) {
      prev = loc;
      this.getNextLocation(path, { loc, i, highI });

      if (i > highI) break;

      const prevPt: IPoint64 = path[i - 1];
      let crossingLoc: Location = loc;

      let result = RectClipLines64.getIntersection(this.rectPath, path[i], prevPt, crossingLoc)
      const ip: IPoint64 = result.ip
      crossingLoc = result.loc

      if (!result.success) {
        i++;
        continue;
      }

      if (loc == Location.inside) {
        this.add(ip, true);
      } else if (prev !== Location.inside) {
        crossingLoc = prev;

        result = RectClipLines64.getIntersection(this.rectPath, prevPt, path[i], crossingLoc);
        const ip2: IPoint64 = result.ip
        crossingLoc = result.loc

        this.add(ip2);
        this.add(ip);
      } else {
        this.add(ip);
      }
    }
  }
}
