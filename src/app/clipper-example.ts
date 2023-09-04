import { AmbientLight, BufferGeometry, CircleGeometry, MathUtils, Mesh, MeshBasicMaterial, PointLight, Scene, Shape, ShapeGeometry, Vector2 } from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";

import { Clipper, FillRule, Path64, Paths64, Point64 } from "clipper2-js";

import { ThreeJSApp } from "./threejs-app"

export class ClipperExample {

  dispose = () => { }

  constructor(app: ThreeJSApp) {

    const scene = new Scene()
    app.scene = scene

    app.camera.position.z = 140

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

    const loader = new FontLoader();

    loader.load('assets/helvetiker_regular.typeface.json', function (font) {

      const union = new Mesh(new TextGeometry('Union', { font: font, size: 10, height: 0, bevelEnabled: false }))
      union.position.set(-135,60,0)
      scene.add(union)

      const intersection = new Mesh(new TextGeometry('Intersection', { font: font, size: 10, height: 0, bevelEnabled: false }))
      intersection.position.set(-30,60,0)
      scene.add(intersection)

      const difference = new Mesh(new TextGeometry('Difference', { font: font, size: 10, height: 0, bevelEnabled: false }))
      difference.position.set(90,60,0)
      scene.add(difference)

    });
    // intersect
    const star1shape = this.createStarShape(50)
    const star1geometry = new ShapeGeometry(star1shape)

    const star1 = new Mesh(star1geometry, new MeshBasicMaterial({ color: 'blue' }))
    star1.position.z = -0.1
    scene.add(star1)

    const star2 = new Mesh(undefined, new MeshBasicMaterial({ color: 'red' }))
    scene.add(star2)

    const intersect = new Mesh(undefined, new MeshBasicMaterial({ color: 'white' }))
    intersect.position.z = 5
    scene.add(intersect)

    // union
    const star3 = new Mesh(star1geometry, new MeshBasicMaterial({ color: 'blue' }))
    star3.position.z = -0.1
    star3.position.x = -120
    scene.add(star3)

    const star4 = new Mesh(undefined, new MeshBasicMaterial({ color: 'red' }))
    star4.position.x = -120
    scene.add(star4)

    const union = new Mesh(undefined, new MeshBasicMaterial({ color: 'white' }))
    union.position.z = 5
    union.position.x = -120
    scene.add(union)

    // difference
    const star5 = new Mesh(star1geometry, new MeshBasicMaterial({ color: 'blue' }))
    star5.position.z = -0.1
    star5.position.x = 120
    scene.add(star5)

    const star6 = new Mesh(undefined, new MeshBasicMaterial({ color: 'red' }))
    star6.position.x = 120
    scene.add(star6)

    const diffmesh: Array<Mesh> = []

    let i = 0
    setInterval(() => {
      // star2 is star1 rotated a bit
      const tempgeometry = star1geometry.clone()
      tempgeometry.rotateZ(MathUtils.degToRad(i))
      //tempgeometry.translate(10, 0, 0)

      const tempshape = this.geometryToShape(tempgeometry)
      const star2geometry = new ShapeGeometry(tempshape)
      star2.geometry = star2geometry
      star4.geometry = star2geometry
      star6.geometry = star2geometry

      const subj = new Paths64();
      const clip = new Paths64();
      subj.push(this.geometryToClipperPath(star1geometry))
      clip.push(this.geometryToClipperPath(star2geometry));
      let solution = Clipper.Intersect(subj, clip, FillRule.NonZero);

      solution.forEach(path => {
        const points = this.clipperPathToPoints(path)
        if (points.length > 0) {
          const shape = new Shape(points)
          intersect.geometry = new ShapeGeometry(shape)
        }
      })

      solution = Clipper.Union(subj, clip, FillRule.NonZero);

      solution.forEach(path => {
        const points = this.clipperPathToPoints(path)
        if (points.length > 0) {
          const shape = new Shape(points)
          union.geometry = new ShapeGeometry(shape)
        }
      })

      solution = Clipper.Difference(subj, clip, FillRule.NonZero);

      if (solution.length > diffmesh.length) {
        solution.forEach(() => {
          const diff = new Mesh(undefined, new MeshBasicMaterial({ color: 'white' }))
          diff.position.z = 5
          diff.position.x = 120
          scene.add(diff)
          diffmesh.push(diff)
        })
      }

      solution.forEach((path, index) => {
        const points = this.clipperPathToPoints(path)
        if (points.length > 0) {
          const shape = new Shape(points)
          diffmesh[index].geometry = new ShapeGeometry(shape)
        }
      })

      i += 1
    }, 1000 / 30)


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

  createStarShape(outerRadius = 50, innerRadius = 20, spikes = 5): Shape {
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
