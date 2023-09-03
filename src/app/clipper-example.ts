import { AmbientLight, BufferGeometry, CircleGeometry, MathUtils, Mesh, MeshBasicMaterial, Path, PointLight, Scene, Shape, ShapeGeometry, Vector2 } from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { ThreeJSApp } from "./threejs-app"
import { ClipType, Clipper, Clipper64, FillRule, Path64, PathType, Paths64, Point64 } from "clipper2-js";
import { ClipperParse } from "../../projects/clipper2-js/tests/clipperparse";

export class ClipperExample {

  dispose = () => { }

  constructor(app: ThreeJSApp) {

    const scene = new Scene()
    app.scene = scene

    app.camera.position.z = 100

    const orbit = new OrbitControls(app.camera, app.domElement);
    orbit.target.set(0, app.camera.position.y, 0)
    //orbit.enableRotate = false;
    orbit.update();

    const ambient = new AmbientLight()
    ambient.intensity = 0.1
    scene.add(ambient)

    const light = new PointLight(0xffffff, 1, 100)
    light.position.set(-1, 1, 2)
    light.shadow.bias = -0.001 // this prevents artifacts
    light.shadow.mapSize.width = light.shadow.mapSize.height = 512 * 2
    scene.add(light)

    // star 1
    const star1shape = this.createStarShape(50, 10)
    const star1geometry = new ShapeGeometry(star1shape)
    star1geometry.center()

    const star1 = new Mesh(star1geometry, new MeshBasicMaterial({ color: 'blue' }))
    star1.position.z = -0.1
    scene.add(star1)

    // star2 is star1 rotated a bit
    const tempgeometry = star1geometry.clone()
    tempgeometry.rotateZ(MathUtils.degToRad(25))
    tempgeometry.translate(15, 0, 0)

    const star2shape = this.geometryToShape(tempgeometry)
    const star2geometry = new ShapeGeometry(star2shape)
    //star2geometry.center()

    scene.add(new Mesh(star2geometry, new MeshBasicMaterial({ color: 'red' })))

    //const rectshape = this.rectangle(4, 4)
    //const rect1geometry = new ShapeGeometry(rectshape)
    //rect1geometry.translate(1, 0, 0)
    //const rect1 = new Mesh(rect1geometry, new MeshBasicMaterial({color:'blue'}))
    //scene.add(rect1)

    //const rect2geometry = new ShapeGeometry(rectshape)
    //rect2geometry.translate(-1, 0, 0)
    //const rect2 = new Mesh(rect2geometry, new MeshBasicMaterial({ color: 'red' }))
    //scene.add(rect2)



    //setTimeout(() => {
    let subj = new Paths64();
    let clip = new Paths64();
    subj.push(this.geometryToClipperPath(star1geometry))
    clip.push(this.geometryToClipperPath(star2geometry));
    let solution = Clipper.Intersect(subj, clip, FillRule.NonZero);
    console.warn(solution)
    //}, 2000);

      //
    //const points = this.stringToPoints("12,-16 14,-16 14,-8 31,-3 19,6 21,14 16,16 16,31 0,20 -6,24 -26,31 -19,6 -23,3 -37,-15 -15,-16 -8,-14 6,-34")
    //const points = this.stringToPoints("65,39 68,40 67,43 85,55 65,61 65,65 62,65 56,85 44,68 40,69 39,66 18,67 31,50 29,48 32,45 24,26 44,32 46,29 49,31 65,18")
    //union const points = this.stringToPoints("65,18 77,8 68,40 100,50 85,55 98,63 65,65 65,98 56,85 52,100 40,69 10,79 18,67 4,68 29,48 10,21 24,26 19,12 46,29 65,2")
    //const points = this.stringToPoints("1,0  2,0  2,1  1,1  -1,1  -1,0") // Union
    //const points = this.stringToPoints("4973567,-9763263  5877852,-3315596  23538292,-6434802  21728374,-520862  24948006,340851  9510565,7864744  21289244,30001982  21669973,37227303  14345387,29638140  8755995,13390312  1393859,16218781  0,14774574  -3036698,17920963  -17899458,23631107  -13690796,15721209  3056717,3108541  -5327573,-7239158  -4083578,-16108995") // Intersection
    const points = this.clipperPathToPoints(solution)
    console.warn(points)
    if (points.length > 0) {

      const shape = new Shape(points)
      const clipper = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial({ color: 'white' }))
      clipper.position.z = 0.1
      scene.add(clipper)
    }

    points.forEach(point => {
      const mesh = new Mesh(new CircleGeometry(0.1))
      mesh.position.set(point.x, point.y, 1)
      scene.add(mesh)
    })


    this.dispose = () => {
      orbit.dispose()
    }
  }

  geometryToClipperPath(geometry: BufferGeometry, scale = 1e6): Path64 {
    const positions = geometry.getAttribute('position')
    const clipperPath = new Path64();

    for (let i = 0; i < positions.count; i++) {
      clipperPath.push(new Point64(
        Math.round(positions.getX(i) * scale),
        Math.round(positions.getY(i) * scale),
      ));
    }
    console.warn('{' + clipperPath.map(pt => `${pt.x},${pt.y}`).join(',') + '}')
    return clipperPath;
  }


  numberArrayToClipperPath(points: Array<number>, scale = 1e6): Path64 {
    const clipperPath = new Path64();

    for (let i = 0; i < points.length/2; i++) {
      clipperPath.push(new Point64(
        Math.round(points[i*2] * scale),
        Math.round(points[i*2+1] * scale),
      ));
    }
    console.warn('{' + clipperPath.map(pt => `${pt.x},${pt.y}`).join(',') + '}')
    return clipperPath;
  }

  geometryToNumberArray(geometry: BufferGeometry, scale = 1e6): Array<number>{
    const positions = geometry.getAttribute('position')
    const points: Array<number> = []
    
    for (let i = 0; i < positions.count; i++) {
      points.push(
        Math.round(positions.getX(i) * scale),
        Math.round(positions.getY(i) * scale)
      )
    }

    console.warn(points)
    return points
  }

  stringToPoints(s: string, scale = 1e6): Array<Vector2>{
    if (!s) return []

    const points : Array<Vector2> = []
    const pairs = s.split('  ')
    console.warn(pairs)
    pairs.forEach(pair => {
      const point = pair.split(',')
      const x = +point[0]
      const y = +point[1]
      points.push(new Vector2(x, y).divideScalar(scale))
    })
    return points
  }

  geometryToShape(geometry: BufferGeometry) {
    const positions = geometry.getAttribute('position')
    const points: Array<Vector2> = []

    for (let i = 0; i < positions.count; i++) {
      points.push(new Vector2(positions.getX(i), positions.getY(i)))
    }

    return new Shape(points)
  }

  pointsToClipperPath(points: Array<Vector2>, scale = 1e6):Path64 {
    const clipperPath = new Path64();

    for (let i = 0; i < points.length; i++) {
      clipperPath.push(new Point64(
        Math.round(points[i].x*scale),
        Math.round(points[i].y*scale),
      ));
    }
    console.warn('{' + clipperPath.map(pt => `${pt.x},${pt.y}`).join(',') + '}')
    return clipperPath;
  }

  clipperPathToPoints(clipperPath: Paths64, scale = 1e6): Array<Vector2> {
    const points: Array<Vector2> = []

    clipperPath.forEach(path => {
      path.forEach(item => {
        points.push(new Vector2(item.x/scale, item.y/scale))
      })
    })
    return points
  }

  createStarShape(outerRadius = 50, innerRadius = outerRadius*0.4, spikes = 5): Shape {
    const shape = new Shape();

    const pi2 = Math.PI * 2;

    let angle = -Math.PI / 2; // Starting angle is pointing up.
    const angleIncrement = pi2 / spikes / 2; // Divide by 2 because there are two vertices (inner & outer) per spike.

    shape.moveTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius)

    for (let i = 0; i < spikes; i++) {
      shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
      angle += angleIncrement;

      shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
      angle += angleIncrement;
    }

    shape.closePath();

    return shape;
  }

  roundedRect(width: number, height: number, radius: number): Shape {
    const ctx = new Shape();
    const halfwidth = width / 2
    const halfheight = height / 2
    ctx.moveTo(-halfwidth + radius, -halfheight);
    ctx.lineTo(halfwidth - radius, -halfheight);
    ctx.quadraticCurveTo(halfwidth, -halfheight, halfwidth, -halfheight + radius);
    ctx.lineTo(halfwidth, halfheight - radius);
    ctx.quadraticCurveTo(halfwidth, halfheight, halfwidth - radius, halfheight);
    ctx.lineTo(-halfwidth + radius, halfheight);
    ctx.quadraticCurveTo(-halfwidth, halfheight, -halfwidth, halfheight - radius);
    ctx.lineTo(-halfwidth, -halfheight + radius);
    ctx.quadraticCurveTo(-halfwidth, -halfheight, -halfwidth + radius, -halfheight);
    ctx.closePath();
    return ctx;
  }

  circleShape(radius: number, segments = 32): Shape {
    const circle = new CircleGeometry(radius, segments)
    const positions = circle.getAttribute('position')
    const points: Array<Vector2> = []

    for (let i = 0; i < positions.count; i++) {
      points.push(new Vector2(positions.getX(i), positions.getY(i)))
    }

    return new Shape(points)
  }

  rectangle(width: number, height: number): Shape {
    const ctx = new Shape();
    const halfwidth = width / 2
    const halfheight = height / 2
    ctx.moveTo(-halfwidth, halfheight);
    ctx.lineTo(halfwidth, halfheight);
    ctx.lineTo(halfwidth, -halfheight);
    ctx.lineTo(-halfwidth, -halfheight);
    ctx.closePath();
    return ctx
  }
}
