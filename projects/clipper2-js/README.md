# clipper2-js
A native Typescript/Javascript port of _[Clipper2](https://github.com/AngusJohnson/Clipper2)_.

## Usage

### Overview

The interface of *clipper2-js* is equivalent to the original C# version.

ClipperD class and corresponding static methods were not converted.
PathD variants of methods were not converted.

The `Clipper` class provides static methods for clipping, path-offsetting, minkowski-sums and path simplification.
For more complex clipping operations (e.g. when clipping open paths or when outputs are expected to include polygons nested within holes of others), use the `Clipper64` class directly.


### Example

```ts
let subj = new Paths64();
let clip = new Paths64();
subj.push(Clipper.makePath([ 100, 50, 10, 79, 65, 2, 65, 98, 10, 21 ]));
clip.push(Clipper.makePath([98, 63, 4, 68, 77, 8, 52, 100, 19, 12]));
let solution = Clipper.Intersect(subj, clip, FillRule.NonZero);
```


## Port Info
* ChatGPT did the original port.  The took a few days to get it to compile and a few more days to remove bugs.
* Context or return objects are used to replicate C# `ref` (pass-by-reference) behaviour.
* Code passes all tests: polygon, line and polytree.
* Uses lower-case (x, y) for point coordinates.
* Variables and metjods have been renamed to camelCase
* Jest units test included

