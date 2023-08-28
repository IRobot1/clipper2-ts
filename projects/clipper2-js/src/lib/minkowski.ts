/*******************************************************************************
* Author    :  Angus Johnson                                                   *
* Date      :  15 October 2022                                                 *
* Website   :  http://www.angusj.com                                           *
* Copyright :  Angus Johnson 2010-2022                                         *
* Purpose   :  Minkowski Sum and Difference                                    *
* License   :  http://www.boost.org/LICENSE_1_0.txt                            *
*******************************************************************************/

import { Clipper } from "./clipper";
import { Point64, PointD } from "./core";


export class Minkowski {
  private static minkowskiInternal(pattern: Point64[], path: Point64[], isSum: boolean, isClosed: boolean): Point64[][] {
    let delta = isClosed ? 0 : 1;
    let patLen = pattern.length;
    let pathLen = path.length;
    let tmp: Point64[][] = new Array(pathLen);

    for (let pathPt of path) {
      let path2: Point64[] = new Array(patLen);
      if (isSum) {
        for (let basePt of pattern)
          path2.push({ x: pathPt.x + basePt.x, y: pathPt.y + basePt.y });
      } else {
        for (let basePt of pattern)
          path2.push({ x: pathPt.x - basePt.x, y: pathPt.y - basePt.y });
      }
      tmp.push(path2);
    }

    let result: Point64[][] = new Array((pathLen - delta) * patLen);
    let g = isClosed ? pathLen - 1 : 0;

    let h = patLen - 1;
    for (let i = delta; i < pathLen; i++) {
      for (let j = 0; j < patLen; j++) {
        let quad: Point64[] = [tmp[g][h], tmp[i][h], tmp[i][j], tmp[g][j]];
        if (!Clipper.isPositive(quad))
          result.push(Clipper.reversePath(quad));
        else
          result.push(quad);
        h = j;
      }
      g = i;
    }
    return result;
  }

  public static sum(pattern: Point64[], path: Point64[], isClosed: boolean): Point64[][] {
    return Clipper.Union(this.minkowskiInternal(pattern, path, true, isClosed), FillRule.NonZero);
  }

  public static sumD(pattern: PointD[], path: PointD[], isClosed: boolean, decimalPlaces: number = 2): PointD[][] {
    let scale = Math.pow(10, decimalPlaces);
    let tmp = Clipper.Union(this.minkowskiInternal(Clipper.scalePath64(pattern, scale),
      Clipper.scalePath64(path, scale), true, isClosed), FillRule.NonZero);
    return Clipper.scalePathsD(tmp, 1 / scale);
  }

  public static diff(pattern: Point64[], path: Point64[], isClosed: boolean): Point64[][] {
    return Clipper.Union(this.minkowskiInternal(pattern, path, false, isClosed), FillRule.NonZero);
  }

  public static diffD(pattern: PointD[], path: PointD[], isClosed: boolean, decimalPlaces: number = 2): PointD[][] {
    let scale = Math.pow(10, decimalPlaces);
    let tmp = Clipper.Union(this.minkowskiInternal(Clipper.scalePath64(pattern, scale),
      Clipper.scalePath64(path, scale), false, isClosed), FillRule.NonZero);
    return Clipper.scalePathsD(tmp, 1 / scale);
  }
}
