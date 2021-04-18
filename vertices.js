// Management of VertexArrayObjects and VertexBufferObjects.
import {tabulate} from './util.js';
import {GL_TYPES} from './webgltypes.js';
import {AttributeSchema} from './shader.js';


// Computes the largest number that divides both `a` and `b`
// From Wikipedia https://en.wikipedia.org/wiki/Euclidean_algorithm#Procedure
function greatestCommonDivisor(a,b) {
    let t = 0;
    if (b > a) {t=a;a=b;b=t} // Swap so that a > b
    while (b !== 0) {
        t = b;
        b = a % b;
        a = t;
    }
    return a;
}

// Computes the lowest integer which has every one of the given
// numbers as a divisor.
function leastCommonMultiple(numbers) {
    let lcm = numbers[0];
    for (let i=1; i<numbers.length; i++) {
        const n_i = numbers[i];
        const gcd = greatestCommonDivisor(lcm,n_i);
        lcm = n_i * lcm / gcd;
    }
    return lcm;
}

// Field packing management of some attributes within a vertex buffer.
export class VertexBufferSchema {
    constructor(attributeSchema) {
        // Work out packing arrangement
        this.fields = new Map(); // field name -> field id
        this.names = [];         // field id -> field name
        this.sizes = [];         // field id -> number of floats in field
        this.offsets = [];       // field id -> field offset
        this.types = [];         // field id -> gl type code
        this.attributeLocs = []; // field id -> shader vertex attribute location
        let i=0, offset=0;
        for (const name of attributeSchema.names) {
            const type = attributeSchema.types.get(name);
            const info = GL_TYPES[type];
            this.fields.set(name,i);
            this.names.push(name);
            this.sizes.push(info.nelements);
            this.offsets.push(offset); // Will increment at the end of the loop
            this.types.push(type);
            this.attributeLocs.push(attributeSchema.locations.get(name));
            i += 1; // Count names
            offset += info.nelements; // Advance by the field size.
        }
        // The offset pointer will end up being equal
        //  to the total number of floating point elements.
        this.structSize = offset;
        if (this.structSize*4 > 255) { // GL standard-enforced limit on stride
            // Corresponds to about 16 vertex attribute locations. (16*4*4)
            throw "Too many attributes to interleave!";
        }
    }
    // Returns the number of floats taken up by `n` of these structs.
    sizeof(n) {
        return n * this.structSize;
    }
    // Sets up vertex pointers into a buffer matching this schema.
    vertexAttribPointer(gl) {
        const FLOAT32_SIZEB = 4; // We only support f32 arrays
        const stride = this.structSize * FLOAT32_SIZEB;
        // Loop once for every struct field we need to set up
        for (let i=0; i<this.names.length; i++) {
            const info = GL_TYPES[this.types[i]];
            const size = info.nelements / info.nattributes; // n components
            const offset = this.offsets[i] * FLOAT32_SIZEB;
            // Matrices fill multiple consecutive attribute locations.
            // This loop runs once for normal types, and N times for matN.
            for (let j=0; j<info.nattributes; j++) {
                gl.vertexAttribPointer(
                    this.attributeLocs[i],
                    size, // components per vertex attribute
                    gl.FLOAT, // we only support uploading F32 arrays
                    false, // `normalized` has no effect for type=gl.FLOAT
                    stride, // byte stride for packing
                    offset + j*(FLOAT32_SIZEB*size), // break down matrices
                );
            }
        }
    }
    // Dices a Float32Array into sub-arrays corresponding to our struct fields.
    // `array` is the typed array, `output` is the (optional) place where the
    // sub-arrays will be appended. Always returns the output array.
    dice(array,output=[]) {
        for (let i=0; i<this.names.length; i++) {
            const start = this.offsets[i];
            output.push(
                array.subarray(start,start+this.sizes[i])
            );
        }
        return output;
    }
    toString() {
        const rows = [['ID','NAME','SIZE','OFFSET','TYPE','ATTR. LOC.']];
        for (let i=0; i<this.names.length; i++) {
            rows.push([
                i,this.names[i],this.sizes[i],this.offsets[i],
                GL_TYPES[this.types[i]].name,this.attributeLocs[i],
            ]);
        }
        return tabulate("VBuf. Schema",rows);
    }
}

class VertexBufferBacking {
    constructor(vbSchema,n=0) {
        this.sch = vbSchema;
        this.length = n;
        this.instances = [];
    }
    acquire() {}
    relenquish() {}
}

// Floating point buffer on the GPU
// Always a "gl.ARRAY_BUFFER".
export class VertexBuffer {
    constructor(gl,size,usage) {
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        // Inform openGL in advance of size and usage
        gl.bufferData(gl.ARRAY_BUFFER,size,usage);
    }
    // Tell OpenGL to GC this buffer
    destroy(gl) {
        gl.deleteBuffer(this.buffer);
    }
    // Upload data to the buffer.
    // Since vertex attributes are always floating point in WebGL1, you
    // should always use floating point arrays to upload data.
    // Arguments:
    //      dstByteOffset:  Offset in bytes at destination where writing starts
    //      data:           TypedArray (or T.A.View) full of data to write
    subData(gl,dstByteOffset,data) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, dstByteOffset, data);
    }
}

export class VertexArraySchema {
    // attrSchema:  AttributeSchema from shader
    // divisors  :  Instanced drawing divisors (default 1)
    constructor(attributeSchema,divisors) {
        this.sch = attributeSchema;
        this.divisors = new Map();
        for (const name in attrSchema.names) {
            this.divisors.set(
                name,
                typeof divisors[name] === 'undefined' ?
                    1 : divisors[name], // 1 default, otherwise the given
            );
        }
    }
    
}

// Represents a vertex array object
export class VertexArray {
    constructor(vertexSchema) {
        this.sch = schema;
    }
    
    // Calls vertexAttribPointer to set up the internal array
    pointer(gl,baseIndex,type) {

    }
}


