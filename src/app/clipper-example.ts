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
    const star1shape = this.createStarShape(50)
    const star1geometry = new ShapeGeometry(star1shape)
    star1geometry.center()

    const star1 = new Mesh(star1geometry, new MeshBasicMaterial({ color: 'blue' }))
    star1.position.z = -0.1
    scene.add(star1)

    // star2 is star1 rotated a bit
    const tempgeometry = star1geometry.clone()
    tempgeometry.rotateZ(MathUtils.degToRad(15))
    //tempgeometry.translate(25, 0, 0)

    const star2shape = this.geometryToShape(tempgeometry)
    const star2geometry = new ShapeGeometry(star2shape)

    scene.add(new Mesh(star2geometry, new MeshBasicMaterial({ color: 'red' })))

    let subj = new Paths64();
    let clip = new Paths64();
    subj.push(this.geometryToClipperPath(star1geometry))
    clip.push(this.geometryToClipperPath(star2geometry));
    let solution = Clipper.Intersect(subj, clip, FillRule.NonZero);

    solution.forEach(path => {
      //const points = this.stringToPoints("19509031,-98078529  38268345,-92387955  55557022,-83146965  70710678,-70710678  83146965,-55557022  92387955,-38268345  98078529,-19509031  100000000,0  98078529,19509031  92387955,38268345  83146965,55557022  70710678,70710678  55557022,83146965  38268345,92387955  19509031,98078529  12500000,98768858  5490969,98078529  -13268345,92387955  -30557022,83146965  -45710678,70710678  -58146965,55557022  -67387955,38268345  -73078529,19509031  -75000000,0  -73078529,-19509031  -67387955,-38268345  -58146965,-55557022  -45710678,-70710678  -30557022,-83146965  -13268345,-92387955  5490969,-98078529  12500000,-98768858")
      const points = this.clipperPathToPoints(path)
      //console.warn(points)
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
    //console.warn('{' + clipperPath.map(pt => `${pt.x},${pt.y}`).join(',') + '}')
    return clipperPath;
  }

  stringToPoints(s: string, scale = 1e6): Array<Vector2> {
    if (!s) return []

    const points: Array<Vector2> = []
    const pairs = s.split('  ')
    //console.warn(pairs)
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

  clipperPathToPoints(path: Path64, scale = 1e6): Array<Vector2> {
    const points: Array<Vector2> = []

    path.forEach(item => {
      points.push(new Vector2(item.x / scale, item.y / scale))
    })
    return points
  }

  createStarShape(outerRadius = 50, innerRadius = outerRadius * 0.4, spikes = 5): Shape {
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
