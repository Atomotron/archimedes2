// WebGL Types
// GL_TYPES is an object with one entry for each OpenGL type code.
// Each entry has, as fields:
// - name       (the name of the type as used by WebGL, 
//                  such that ''+gl[GL_TYPES[code].name] === code)
// - nelements  (the number of primitive elements per unit of this type.
//                  for example, FLOAT_MAT4 has 16 elements and FLOAT_VEC3 has 3.)
// - nbytes     (the number of bytes require to store something of this type.
//                  for example, FLOAT_MAT4 takes 64 bytes.)
// - TypedArray (a JS TypedArray capable of containing primitive elements,
//                  for example, FLOAT_MAT4 can be stored in Float32Array.)
// - uniformv   (the name of the WebGL uniform setter function, meant to be
//                  used like gl[GL_TYPES[code].uniformv](location,transpose,value) )
//
// GL_TYPE_CODES is an object that maps names to codes, such that gl[name] === GL_TYPE_CODES[name].

// Test that GL_TYPES and GL_TYPE_CODES matches OpenGL
// Must be given a webgl context in order to run.
function GL_TYPES_test(gl) {
    for (const code in GL_TYPES) {
        if (''+gl[GL_TYPES[code].name] !== code) {
            console.error(`Mistake in GL_TYPES: Code ${code} is named ${GL_TYPES[code].name}, but gl[${GL_TYPES[code].name}] is ${gl[GL_TYPES[code].name]}.`);
        }
    }
    for (const name in GL_TYPE_CODES) {
        if (gl[name] !== GL_TYPE_CODES[name]) {
            console.error(`Mistake in GL_TYPE_CODES: gl[${name}] is ${gl[name]} but GL_TYPE_CODES[${name}] is ${GL_TYPE_CODES[name]}.`);
        }
    }
}


GL_TYPES = {
     0x1400:{
        TypedArray : Int8Array,
        name : "BYTE",
        nbytes : 1,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x1401:{
        TypedArray : Uint8Array,
        name : "UNSIGNED_BYTE",
        nbytes : 1,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x1402:{
        TypedArray : Int16Array,
        name : "SHORT",
        nbytes : 2,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x1403:{
        TypedArray : Uint16Array,
        name : "UNSIGNED_SHORT",
        nbytes : 2,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x1404:{
        TypedArray : Int32Array,
        name : "INT",
        nbytes : 4,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x1405:{
        TypedArray : Uint32Array,
        name : "UNSIGNED_INT",
        nbytes : 4,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x1406:{
        TypedArray : Float32Array,
        name : "FLOAT",
        nbytes : 4,
        nelements : 1,
        uniformv : "uniform1fv",
     },
     0x8B50:{
        TypedArray : Float32Array,
        name : "FLOAT_VEC2",
        nbytes : 8,
        nelements : 2,
        uniformv : "uniform2fv",
     },
     0x8B51:{
        TypedArray : Float32Array,
        name : "FLOAT_VEC3",
        nbytes : 12,
        nelements : 3,
        uniformv : "uniform3fv",
     },
     0x8B52:{
        TypedArray : Float32Array,
        name : "FLOAT_VEC4",
        nbytes : 16,
        nelements : 4,
        uniformv : "uniform4fv",
     },
     0x8B53:{
        TypedArray : Int32Array,
        name : "INT_VEC2",
        nbytes : 8,
        nelements : 2,
        uniformv : "uniform2iv",
     },
     0x8B54:{
        TypedArray : Int32Array,
        name : "INT_VEC3",
        nbytes : 12,
        nelements : 3,
        uniformv : "uniform3iv",
     },
     0x8B55:{
        TypedArray : Int32Array,
        name : "INT_VEC4",
        nbytes : 16,
        nelements : 4,
        uniformv : "uniform4iv",
     },
     0x8B56:{
        TypedArray : Int32Array,
        name : "BOOL",
        nbytes : 4,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x8B57:{
        TypedArray : Int32Array,
        name : "BOOL_VEC2",
        nbytes : 8,
        nelements : 2,
        uniformv : "uniform2iv",
     },
     0x8B58:{
        TypedArray : Int32Array,
        name : "BOOL_VEC3",
        nbytes : 12,
        nelements : 3,
        uniformv : "uniform3iv",
     },
     0x8B59:{
        TypedArray : Int32Array,
        name : "BOOL_VEC4",
        nbytes : 16,
        nelements : 4,
        uniformv : "uniform4iv",
     },
     0x8B5A:{
        TypedArray : Float32Array,
        name : "FLOAT_MAT2",
        nbytes : 16,
        nelements : 4,
        uniformv : "uniformMatrix2fv",
     },
     0x8B5B:{
        TypedArray : Float32Array,
        name : "FLOAT_MAT3",
        nbytes : 36,
        nelements : 9,
        uniformv : "uniformMatrix3fv",
     },
     0x8B5C:{
        TypedArray : Float32Array,
        name : "FLOAT_MAT4",
        nbytes : 64,
        nelements : 16,
        uniformv : "uniformMatrix4fv",
     },
     0x8B5E:{
        TypedArray : Int32Array,
        name : "SAMPLER_2D",
        nbytes : 4,
        nelements : 1,
        uniformv : "uniform1iv",
     },
     0x8B60:{
        TypedArray : Int32Array,
        name : "SAMPLER_CUBE",
        nbytes : 4,
        nelements : 1,
        uniformv : "uniform1iv",
     },
}
GL_TYPE_CODES = {
    BOOL : 0x8B56,
    BOOL_VEC2 : 0x8B57,
    BOOL_VEC3 : 0x8B58,
    BOOL_VEC4 : 0x8B59,
    BYTE : 0x1400,
    FLOAT : 0x1406,
    FLOAT_MAT2 : 0x8B5A,
    FLOAT_MAT3 : 0x8B5B,
    FLOAT_MAT4 : 0x8B5C,
    FLOAT_VEC2 : 0x8B50,
    FLOAT_VEC3 : 0x8B51,
    FLOAT_VEC4 : 0x8B52,
    INT : 0x1404,
    INT_VEC2 : 0x8B53,
    INT_VEC3 : 0x8B54,
    INT_VEC4 : 0x8B55,
    SAMPLER_2D : 0x8B5E,
    SAMPLER_CUBE : 0x8B60,
    SHORT : 0x1402,
    UNSIGNED_BYTE : 0x1401,
    UNSIGNED_INT : 0x1405,
    UNSIGNED_SHORT : 0x1403,
}

