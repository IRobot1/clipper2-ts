import { ClipType, FillRule, Path64, Paths64, Point64 } from "../src/lib/core"

export class TestCase {

  constructor(
    public caption: string,
    public clipType: ClipType,
    public fillRule: FillRule,
    public area: number,
    public count: number,
    public GetIdx: number,
    public subj: Paths64,
    public subj_open: Paths64,
    public clip: Paths64,
    public testNum: number) { }
}

export class ClipperParse {

  static testCases(lines: string[]): TestCase[] {
    let caption = ""
    let ct: ClipType = ClipType.None
    let fillRule: FillRule = FillRule.EvenOdd
    let area: number = 0
    let count: number = 0
    let GetIdx: number = 0
    const subj = new Paths64()
    const subj_open = new Paths64()
    const clip = new Paths64()

    const cases: TestCase[] = []

    for (const s of lines) {
      if (s.trim() === "") {
        if (GetIdx !== 0) {
          cases.push(new TestCase(caption, ct, fillRule, area, count, GetIdx, new Paths64(...subj), new Paths64(...subj_open), new Paths64(...clip), cases.length + 1))
          subj.length = 0
          subj_open.length = 0
          clip.length = 0
          GetIdx = 0
        }
        continue
      }

      if (s.startsWith("CAPTION: ")) {
        caption = s.substring(9)
        continue
      }

      if (s.startsWith("CLIPTYPE: ")) {
        if (s.includes("INTERSECTION")) {
          ct = ClipType.Intersection
        } else if (s.includes("UNION")) {
          ct = ClipType.Union
        } else if (s.includes("DIFFERENCE")) {
          ct = ClipType.Difference
        } else {
          ct = ClipType.Xor
        }
        continue
      }

      if (s.startsWith("FILLTYPE: ") || s.startsWith("FILLRULE: ")) {

        if (s.includes("EVENODD")) {
          fillRule = FillRule.EvenOdd
        } else if (s.includes("POSITIVE")) {
          fillRule = FillRule.Positive
        } else if (s.includes("NEGATIVE")) {
          fillRule = FillRule.Negative
        } else {
          fillRule = FillRule.NonZero
        }
        continue
      }

      if (s.startsWith("SOL_AREA: ")) {
        area = +s.substring(10)
        continue
      }

      if (s.startsWith("SOL_COUNT: ")) {
        count = +s.substring(11)
        continue
      }

      if (s.startsWith("SUBJECTS_OPEN")) {
        GetIdx = 2
        continue
      } else if (s.startsWith("SUBJECTS")) {
        GetIdx = 1
        continue
      } else if (s.startsWith("CLIPS")) {
        GetIdx = 3
        continue
      }

      const paths: Paths64 | undefined = ClipperParse.pathFromStr(s)

      if (!paths || paths.length == 0) {
        if (GetIdx == 3) {
          //return cases
        }
        if (s.indexOf("SUBJECTS_OPEN") == 0) {
          GetIdx = 2
        } else if (s.indexOf("CLIPS") == 0) {
          GetIdx = 3
        } else {
          //return cases
        }
        continue
      }

      if (GetIdx === 1) {
        subj.push(...paths)
      } else if (GetIdx === 2) {
        subj_open.push(...paths)
      } else {
        clip.push(...paths)
      }
    }

    return cases
  }

  static pathFromStr(s: string | undefined): Paths64 {
    const pp = new Paths64()
    if (s) {
      const p = new Path64()
      const pairs = s.split(' ')

      pairs.forEach(pair => {
        const point = pair.split(',')
        p.push(new Point64(+point[0], +point[1]))
      })

      pp.push(p)
    }
    return pp
  }

  static longTryParse(s: string): number | undefined {
    const parsed = Number(s)
    if (isNaN(parsed)) {
      return undefined
    }
    return parsed
  }


}
