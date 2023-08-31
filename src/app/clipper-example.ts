import { AmbientLight, CircleGeometry, MathUtils, Mesh, MeshBasicMaterial, Path, PointLight, Scene, Shape, ShapeGeometry, Vector2 } from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { ThreeJSApp } from "./threejs-app"
import { ClipType, Clipper, Clipper64, FillRule, Path64, PathType, Paths64 } from "clipper2-js";

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

    const star1 = [
      new Vector2(100, 50),
      new Vector2(10, 79),
      new Vector2(65, 2),
      new Vector2(65, 98),
      new Vector2(10, 21),
    ]

    const star2 = [
      new Vector2(98, 63),
      new Vector2(4, 68),
      new Vector2(77, 8),
      new Vector2(52, 100),
      new Vector2(19, 12)
    ]


    const star1shape = this.createStarShape()
    const circleshape = new Shape(star2)

    const rectgeometry = new ShapeGeometry(star1shape)
    rectgeometry.center()

    const rect = new Mesh(rectgeometry, new MeshBasicMaterial({ color: 'blue' }))
    scene.add(rect)

    const circgeometry = rectgeometry.clone()
    circgeometry.rotateZ(MathUtils.degToRad(15))

    const circle = new Mesh(circgeometry)
    scene.add(circle)

    setTimeout(() => {
      let subj = new Paths64();
      let clip = new Paths64();
      subj.push(this.pointsToClipperPath(star1shape.getPoints()))
      clip.push(this.pointsToClipperPath(star1shape.getPoints()));
      let solution = Clipper.Intersect(subj, clip, FillRule.NonZero);
      console.warn(solution)
    }, 2000);

    //const points = this.clipperPathToPoints(solution)
    //console.warn(points)
    //const shape = new Shape(points)
    //const clipper = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial({ color: 'red' }))
    ////clipper.position.x = 1
    //scene.add(clipper)


    this.dispose = () => {
      orbit.dispose()
    }
  }

  pointsToClipperPath(points: Array<Vector2>, scale = 1) {
    const clipperPath = new Path64();

    for (let i = 0; i < points.length; i++) {
      clipperPath.push({
        x: Math.round(points[i].x * scale),
        y: Math.round(points[i].y * scale)
      });
    }

    return clipperPath;
  }
  clipperPathToPoints(clipperPath: Paths64, scale = 1e5): Array<Vector2> {
    const points: Array<Vector2> = []

    clipperPath.forEach(path => {
      path.forEach(item => {
        // TODO: scaling
        points.push(new Vector2(item.x, item.y))
      })
    })
    return points
  }

  createStarShape(): Shape {
    const shape = new Shape();

    const outerRadius = 50;
    const innerRadius = outerRadius * 0.4;
    const spikes = 5;
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
}
