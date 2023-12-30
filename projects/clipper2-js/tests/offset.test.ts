import { Paths64, Clipper, JoinType, EndType } from '../src/public-api';

describe('InflatePaths', () => {
  it('offsets an open line', () => {
    const paths = new Paths64();
    paths.push(Clipper.makePath([0, 0, 10, 0]))

    const inflatedPaths = Clipper.InflatePaths(
      paths,
      1,
      JoinType.Miter,
      EndType.Butt,
    );

    expect(inflatedPaths).toEqual([[
      { x: 10, y: 1, },
      { x: -0, y: 1, },
      { x: -0, y: -1, },
      { x: 10, y: -1, },
    ]]);
  })

})