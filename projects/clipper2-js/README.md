# clipper2-js
A native Typescript/Javascript port of Clipper2

![image](https://github.com/IRobot1/clipper2-ts/assets/25032599/d7d372fe-d680-46c3-bc98-01a057e92b2a)


### Overview

clipper2-js was ported from the original [Clipper2 C# implementation](https://github.com/AngusJohnson/Clipper2).  However, the Java implementation was used as guidance for some conversion solutions

Clipper2 performs all clipping operations using integer coordinates internally.  Since Javascript doesn't have a native integer data type, all values are rounded. To avoid precision loss, its recommended to scale up any values before adding paths and scale down, by the same factor, the clipped results.

The `Clipper` class provides static methods for clipping, path-offsetting, minkowski-sums and path simplification.
For more complex clipping operations (e.g. when clipping open paths or when outputs are expected to include polygons nested within holes of others), use the `Clipper64` class directly.

### Documentation

[Clipper2 HTML documentation](http://www.angusj.com/clipper2/Docs/Overview.htm)

### Example

```ts
const subj = new Paths64();
const clip = new Paths64();
subj.push(Clipper.makePath([ 100, 50, 10, 79, 65, 2, 65, 98, 10, 21 ]));
clip.push(Clipper.makePath([98, 63, 4, 68, 77, 8, 52, 100, 19, 12]));
const solution = Clipper.Intersect(subj, clip, FillRule.NonZero);
```

### Developer Notes
* An Angular project is used to host clipper2-js, but the library does not depend on Angular.
* Jest is used for unit tests
* All line units tests are passing.  Some polygon tests are still failing and needs further investigation. However, the example demonstrates its basically working.

### Support
Bug fixes will be integrated when original clipper2 has new releases.

## Conversion to Typescript
* ChatGPT did most of the code conversion.  It took a few more days to get resulting code to compile. A few more days to add unit tests and remove bugs I'd introduced.
* Context or return objects are used to replicate C# `ref` (pass-by-reference) behaviour.
* Uses lower-case (x, y) for point coordinates.
* Variables and methods have been renamed to camelCase
* Jest units test included

