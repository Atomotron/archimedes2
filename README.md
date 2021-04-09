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

This module contains vector and matrix algebra routines. It exposes them with a fourfold interface: every method is available as an assembly-like operand/output function, an in-place modification, a static constructor, and an allocating infix operator.
