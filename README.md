<img src="https://raw.githubusercontent.com/Atomotron/archimedes2/master/logo.svg" alt="AE2 logo" width="250" align="right">

# Archimedes Engine 2

Our team wrote [a WebGL engine](https://github.com/Atomotron/ld47-prep) for Ludum Dare 47. It worked pretty well, so for Lumdum Dare 48 we are making a second version. The engine is named *Archimedes Engine 2*, because it's based on the engine we used to create [Shadow of Archimedes](https://github.com/Atomotron/shadow-of-archimedes).

The engine is composed of several modules, documented below:
- webgltypes.js (Helpful dictionary for interpreting webgl types)
- vector.js (Vector math)

## Webgltypes

Webgl functions like `getActiveUniform` produce information about uniforms and attributes in shaders. However, the types obtained this way are in the form of opaque OpenGL enumeration integers. The `webgltypes.js` module contains an object that maps the integer values to objects full of useful information.

`GL_TYPES` is an object with one entry for each OpenGL type code.
 Each entry has, as fields:
 - name       (the name of the type as used by WebGL, such that `''+gl[GL_TYPES[code].name] === code`)
 - nelements  (the number of primitive elements per unit of this type. for example, `FLOAT_MAT4` has 16 elements and `FLOAT_VEC3` has 3.)
 - nbytes     (the number of bytes require to store something of this type. for example, `FLOAT_MAT4` takes 64 bytes.)
 - TypedArray (a JS TypedArray capable of containing primitive elements, for example, `FLOAT_MAT4` can be stored in a `Float32Array`.)
 - uniformv   (the name of the WebGL uniform setter function, meant to be used like `gl[GL_TYPES[code].uniformv](location,transpose,value)` )

`GL_TYPE_CODES` is an object that maps names to codes, such that `gl[name] === GL_TYPE_CODES[name]`.

### Example use of webgltypes
```javascript
const info = gl.getActiveUniform(program_handle,i);
const type = GL_TYPES[info.type];
console.log(type.name); // Print standard GL name of type.
console.log(type.nbytes); // Print the number of bytes required to store one
console.log(type.nelements); // Print the number of primitive elements per type.
console.log(type.TypedArray); // Print the constructor of a suitable typed array 

const storage = new type.TypedArray(type.nelements);
gl[type.uniformv](id,storage); // This will upload the appropriate data.
```

## Vector

This module contains vector and matrix algebra routines. It exposes them with a fourfold code-generated interface, described below.

### Variant Methods
All methods are available to be called in four different ways. They are based on each other in a systematic way. For example, consider vector addition; four methods will be available.
1. `c.eqAdd(a,b)`, which sets `c` to the sum of `a` and `b`. Like `c = a+b`.
2. `a.addEq(b)`, which sets `a` to the sum of `a` and `b`. Like `a += b`.
3. `a.add(b)`, which allocates and returns a new vector, the sum of `a` and `b`. Like `a + b`.
4. `VecN.Add(a,b)` Constructs a new `VecN` (for some integer N) and makes it the sum of `a` and `b`. This is not often used for addition, but it is very useful for certain methods. For example, the crucial `VecN.Zero()` zero-value constructor is made in this way, originating in an implementation of `eqZero`.

### Vector Types
- Floating point vectors `Vec1, Vec2, Vec3, Vec4`
- 32-bit integer vectors `Vec1I, Vec2I, Vec3I, Vec4I`

### Base vector methods
On all vectors:
- `eqFrom(x,y,...)` (Setter)
- `eqAdd`
- `eqSub`
- `eqMul`
- `dot` (dot product)
- `mag` (length)
- `mag2` (length squared)
- `eqNorm` (makes length 1 and keeps direction)
- `eqMapMag` (maps length through magnitude function)

Only on Vec2:
- eqRotate(self,theta)

#### Property accessors and special constructors:
On all vector types, you can get and set elements with `v.x`, `v.y`, `v.z`, and `v.w`, as appropriate for the number of elements in the vector. (For example, Vec2 would have `x` and `y` attributes.)

You can also, as appropriate for the number of dimensions, use x/y/z/w unit vector constructors:
- `eqXhat, eqYhat, eqZhat, eqWhat` to set existing vectors to the unit vectors
- `Vec4.Xhat(), Vec4.Yhat(), Vec4.Zhat(), Vec4.What()` to construct the unit vectors
Unsurprisingly, these are available depending on the dimensionality of the vector class. (For example, `Vec2` has `eqXhat` and `eqYhat`).

## Matrices
Some code taken from [gl-matrix](https://github.com/toji/gl-matrix).

### Matrix Element Naming Scheme

Matrix elements are assigned numbers with the same indexing scheme [as is used on Wikipedia](https://en.wikipedia.org/wiki/Matrix_(mathematics)): `a23` is the element on row `2` and column `3`. When a vector is being transformed, row `i` of the input vector scales the whole column `a0i`,`a1i`,`a2i`... of the matrix. Row `j` of the output vector is built from the whole row `aj0`,`aj1`,`aj2`... of the matrix.

Matrix elements can be accessed with index notation, like in the following:
```javascript
const A = Mat3.From(
    1, 2, 3,
   -4, 5, 6,
   -7,-8 -9,
);
console.log(a21); // prints -8, from row 2 column 1
```

### Matrix Operations
- eqCompose (compose with another matrix)
- eqComposeFrom (compose from a matrix whose elements are passed in as arguments)
- eqInverse (inverts the matrix)
- eqAdjugate (computes matrix adjugate)
- determinant (returns determinant)
- All vector methods (eqAdd, eqSub, eqMul, dot, norm...)
