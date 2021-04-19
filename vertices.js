// Management of VertexArrayObjects and VertexBufferObjects.
import {tabulate} from './util.js';
import {GL_TYPES} from './webgltypes.js';
import {AttributeSchema} from './shader.js';
import {GL_TYPE_INDIRECT_ARRAYS} from './vector.js';


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
        this.Struct = this.makeStructClass();
    }
    // Create a struct object that can store one of the structs
    // that this schema describes. 
    makeStructClass() {
        // closure variables
        const structSize = this.structSize; 
        const names = this.names;
        const offsets = this.offsets;
        const sizes = this.sizes;
        const indirectArrayConstructors = this.types.map(
            t => GL_TYPE_INDIRECT_ARRAYS[GL_TYPES[t].name]
        );
        // Create class
        return class Struct {
            // Takes an array, and its number within the array.
            constructor(f32array,i) {
                this.acquisitionIndex = 0; // Handle for VertexBufferBacking
                const base = structSize*i;
                // Iterate through each struct field and add it to `this`
                for (let i=0; i < names.length; i++) {
                    const offset = base+offsets[i];
                    this[names[i]] = new indirectArrayConstructors[i](
                        f32array.subarray(offset,offset+sizes[i])
                    );
                }
            }
            // Rebases contained indirect arrays to new f32 array
            rebaseFrom(f32array,i) {
                const base = structSize*i;
                // Iterate through each struct field and add it to `this`
                for (let i=0; i < names.length; i++) {
                    const offset = base+offsets[i];
                    const subarray = f32array.subarray(offset,offset+sizes[i]);
                    const indirectArray = this[names[i]];
                    // Copy backwards to save old value
                    subarray.set(indirectArray.a);
                    // Change indirectarray backing pointer
                    indirectArray.a = subarray;
                }
            }
            // Swaps contents with another struct
            swap(other) {
               for (let i=0; i < names.length; i++) {
                    const name = names[i];
                    const ours = this[name];
                    this[name] = other[name];
                    other[name] = ours;
                }
            }
        }
    }
    // Returns the number of f32s it would take to contain `n` of these structs
    sizeof(n) {
        return this.structSize*n;
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
                gl.enableVertexAttribArray(this.attributeLocs[i]);
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
    // Dices a float23 array into indirect arrays. Existing arrays may be
    // provided via `structs` for rebasing. If more output arrays
    // are needed than are given as input, new structs will be appended
    // to the given list.
    // Returns the new list of structs.
    dice(array,structs=[]) {
        const nStructs = Math.floor(array.length / this.structSize);
        for (let i=0; i<nStructs; i++) {
            // Check if we should rebase
            if (structs.length > i) {
                structs[i].rebaseFrom(array,i);
            } else {
                // New struct needed
                structs.push(new this.Struct(array,i));
            }
        }
        return structs;
    }
    // Prints a table of the schema for debugging and development purposes.
    toString() {
        const rows = [['ID','NAME','SIZE','OFFSET','TYPE','ATTR. LOC.']];
        for (let i=0; i<this.names.length; i++) {
            rows.push([
                i,this.names[i],this.sizes[i],this.offsets[i],
                GL_TYPES[this.types[i]].name,this.attributeLocs[i],
            ]);
        }
        return tabulate("Vertex Buffer Schema",rows);
    }
}

// A CPU-RAM backing buffer containing data to be uploaded to attribute buffers
// Mixes array-like behavior (growTo, structs[]) with stack-like behavior
//   (acquire,relenquish,count,clear)
// NOTE: Only structs below `count` will be streamed to the GPU or drawn!
// Interface:
//  acquire()         : get a struct at the end of the array
//  relenquish(struct): hand a struct back, and shrink the array
//  clear             : resets stack to nothing
//  growTo(count)     : makes sure the backing array is at least this big
//  swap(i,j)         : exchange two structs in the array
//  count             : number of active acquired elements
//  structs[]         : attribute containing list of all allocated structs
//  array             : f32 typed array containing packed data
export class VertexBufferBacking {
    static GROW_FACTOR = 2; // Size doubles with every growth
    // Arguments:
    //  vbSchema: Vertex Buffer Schema
    //  count   : number of vertex structs to preallocate
    constructor(vbSchema,count=0) {
        this.sch = vbSchema;
        this.count = count;
        this.structs = [];
        this.array = new Float32Array(0);
        // The next size to grow to.
        this.nextSize = count*VertexBufferBacking.GROW_FACTOR || 1;
        // Initialize array
        this.growTo(count);
    }
    // Grows the buffer to contain at least `count` structs.
    // May do nothing, if we're already big enough.
    growTo(count) {
        if (this.structs.length < count) {
            // Create a new array
            this.array = new Float32Array(this.sch.sizeof(this.nextSize));
            // Update structs and make more.
            this.structs = this.sch.dice(this.array,this.structs);
            // Increase next size
            this.nextSize = Math.ceil( // For noninteger growth factors
                this.nextSize*VertexBufferBacking.GROW_FACTOR
            );
        }
    }
    acquire() {
        const index = this.count; // New index
        this.growTo(this.count + 1);
        this.count += 1;
        const struct = this.structs[index];
        struct.acquisitionIndex = index;
        return struct;
    }
    swap(i,j) {
        this.structs[i].swap(this.structs[j]);
    }
    relenquish(struct) {
        if (this.count == 0) return; // Should never happen
        const index = struct.acquisitionIndex;
        // Make sure the struct being relenquished is on top of the stack
        if (index !== this.count-1) {
            this.swap(index,this.count-1);
        }
        // Decrement the count to not include the struct
        this.count -= 1;
    }
    clear() {
        this.count = 0;
    }
}

// Floating point buffer on the GPU
// Always a "gl.ARRAY_BUFFER".
export class VertexBuffer {
    constructor(gl,usage,size=null) {
        this.usage = usage;
        this.size = size || 0;
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        // Inform openGL in advance of size and usage, if a size was set.
        if (size !== null) {
            gl.bufferData(gl.ARRAY_BUFFER,size,usage);
        }
    }
    // Tell OpenGL to GC this buffer
    destroy(gl) {
        gl.deleteBuffer(this.buffer);
    }
    // Synchronizes with buffer backing
    syncBacking(gl,backing) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        if (backing.array.length !== this.size) {
            // We need to allocate new GPU memory
            this.size = backing.array.length;
            gl.bufferData(
                gl.ARRAY_BUFFER,
                backing.array,
                this.usage,
            );
        } else {
            // We can reuse the same memory.
            gl.bufferSubData(gl.ARRAY_BUFFER, 
                0, // No dst offset
                backing.array.subarray(
                    0,backing.schema.sizeof(backing.count)
                ),
            );
        }
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


