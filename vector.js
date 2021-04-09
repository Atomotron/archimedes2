'use strict'
// The math of Euclidian space.
// Heavy use of automatic code generation inside.

// Tests are the best documentation, eh?
function __testVectorCode() {
    function asserteq(a,b) {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
            throw [a,"!==",b];
        }
    }
    //////// Vec1 - a one-dimensional vector
    let a = new Float32Array(1); 
    let v1 = new Vec1(a); // Demonstrate slice construction
    asserteq(v1.typecheck(),true);
    let va = Vec1.From(1.0);
    let vb = Vec1.From(2.0);
    // Test all four ways to call `add`
    let vc = Vec1.Add(va,vb); // constructor
    asserteq(vc.x,3.0);
    asserteq(v1.eqAdd(va,vb),vc); // output
    v1.eq(va);
    asserteq(v1.addEq(vb),vc); // in-place
    asserteq(va.add(vb),vc);   // allocating
    // Test multiplication
    asserteq(vb.mul(10),Vec1.From(20.0));
    // Test dot product, magnitude, and map magnitude
    asserteq(va.dot(vb),2.0);
    asserteq(vb.mag(),2.0);
    asserteq(vb.mag2(),4.0);
    function f(r) {return r*700};
    asserteq(vb.mapMag(f),Vec1.From(1400.0));
    
    //////// Vec2 - a two-dimensional vector
    va = Vec2.Xhat();
    vb = Vec2.Yhat();
    vc = va.add(vb);
    asserteq(vc,Vec2.From(1,1));
    asserteq(vc.dot(va),1.0);
    asserteq(1.0,va.dot(vc));
    asserteq(va.mul(3),Vec2.From(3,0));
    
    //////// Vec3 - a three-dimensional vector
    va = Vec3.Xhat();
    vb = Vec3.Yhat();
    vc = va.add(vb).add(Vec3.Zhat());
    asserteq(vc,Vec3.From(1,1,1));
    asserteq(vc.dot(va),1.0);
    asserteq(1.0,va.dot(vc));
    asserteq(va.mul(3),Vec3.From(3,0,0));
    
    //////// Vec4 - a four-dimensional vector
    va = Vec4.Xhat();
    vb = Vec4.Yhat();
    vc = va.add(vb).add(Vec4.Zhat()).add(Vec4.What());
    asserteq(vc,Vec4.From(1,1,1,1));
    asserteq(vc.dot(va),1.0);
    asserteq(1.0,va.dot(vc));
    asserteq(va.mul(3),Vec4.From(3,0,0,0));
}

// A helper function that can determine the names of a function's arguments.
// Copied, more or less, straight from angularjs source code
// https://github.com/angular/angular.js/blob/9bff2ce8fb170d7a33d3ad551922d7e23e9f82fc/src/auto/injector.js#L77
// NOTE: THIS CAN BE CONFUSED BY FUNCTION CALLS INSIDE DEFAULT ARGS
// (I won't bother fixing that because I won't be using it that way.)
function extractArgs(fn) {
    const ARROW_ARG = /^([^(]+?)=>/;
    const FN_ARGS = /^[^(]*\(\s*([^)]*)\)/m;
    const FN_ARG_SPLIT = /,/;
    const FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    
    // Strip out function signature
    const strfn = fn.toString();
    const strfn_nocomments = strfn.replace(STRIP_COMMENTS, '');
    const signature = strfn_nocomments.match(ARROW_ARG) ||
                      strfn_nocomments.match(FN_ARGS);
    const args = signature[1].split(FN_ARG_SPLIT);
    // Patch to split when everything is an empty string
    if (args.every(x=>!x)) {
        return [];
    }
    return args;
}

function generateVariantMethods(Class) {
    const IS_EQ_FUNCTION = /^eq.*/;
    function attachMethod(target,name,method_string) {
        Reflect.defineProperty(target,name,
        {
            configurable: true,
            writable: true,
            enumerable: false,
            value: eval(`(${method_string})`),
        });
    }
    // Array replacement method, set `to` to null to delete.
    function replace(a,from,to=null) { 
        const out = [];
        for (const x of a) {
            if (x === from) {
                if (to !== null) out.push(to);
            }
            else out.push(x);
        }
        return out;
    }
    // String manipulation
    function upperFirst(s) {
        return s.slice(0,1).toUpperCase() +
               s.slice(1)
    }
    function lowerFirst(s) {
        return s.slice(0,1).toLowerCase() +
               s.slice(1)
    }
    for (const name of Reflect.ownKeys(Class.prototype)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(Class.prototype,name);
        if (!descriptor.value) {
            continue; // A descriptor without a value is something like a getter/setter
        }
        const value = descriptor.value;
        // Start with instance methods begining with `eq`
        if (value instanceof Function && IS_EQ_FUNCTION.test(name)) {
            const args = extractArgs(value);
            const base_name = name.slice(2); // Name without eq prefix
            // Generate x__eq method that uses this as the self argument
            // Example: a.addeq(b) --> a.eqadd(a,b)
            if (base_name !== '') {
                const method_name = lowerFirst(base_name)+'Eq';
                const outer_args = replace(args,'self',null).join(',');
                const inner_args = replace(args,'self','this').join(',');
                attachMethod(Class.prototype,method_name,
`function ${method_name} (${outer_args}) {
    return this.${name}(${inner_args});
}`              );
            }
            // Generate x__ method that constructs a new `this` to use as output
            // and that uses `this` as the self-argument.
            // Example: a.add(b) --> (new vector).eqadd(a,b)
            if (base_name !== '') {
                const method_name = lowerFirst(base_name);
                const outer_args = replace(args,'self',null).join(',');
                const inner_args = replace(args,'self','this').join(',');
                attachMethod(Class.prototype,method_name,
`function ${method_name} (${outer_args}) {
    const constructed = this.constructor.Default();
    return constructed.${name}(${inner_args});
}`              );
            }
            // Generate static X__ method that constructs a new `this`
            // but otherwise behaves like the eq__ method.
            // Example: Vec2.Add(a,b) --> (new vector).eqadd(a,b)
            if (base_name !== '') {
                const method_name = upperFirst(base_name);
                const outer_args = args.join(',');
                const inner_args = args.join(',');
                // Attaching to Class makes it static
                attachMethod(Class,method_name, 
`function ${method_name} (${outer_args}) {
    const constructed = this.Default();
    return constructed.${name}(${inner_args});
}`              );
            }
        }
    }
    return Class;
}

// An indirect wrapper of a typed array.
//
// All of the math types in this engine are stored as pointers to
// typed arrays. This is necessary so that the underlying memory
// can be re-allocated when buffers must be resized, without invalidating
// all of the objects being passed around. 
const IndirectArray = generateVariantMethods(
class IndirectArray {
    // The typechecking method will verify that the array pointer `a`
    // points to a typed array that is an instance of `TYPE,` and has
    // length `SIZE.` These should be overriden in subclasses.
    static TYPE = null;
    static SIZE = null;
    // The constructor takes the array that should be stored and does not
    // allocate. That's because often the backing array will come from a
    // slice of another array.
    constructor(a) {
        this.a = a;
    }
    // Check to see if another indirect array is binary-compatible with this one.
    // In other words, this ensures that it has the right size and type.
    // A compatible indirect array can be used in all of the same uniform and
    // attribute 
    is_compatible(other) {
        return other.a instanceof this.constructor.TYPE &&
               other.a.length == this.constructor.SIZE;
    }
    // Returns true iff this.a matches this.TYPE and this.SIZE.
    typecheck() {
        return this.is_compatible(this);
    }    
    // Constructs an instance
    static Default() {
        const a = new this.TYPE(this.SIZE);
        return new this(a);
    }
    // Duplicate this, whatever it is.
    clone() {
        return this.constructor.Default().eq(this);
    }
    // Copy another array's contents to this one.
    // From this, the codegen will produce...
    // IndirectArray.Eq() // construct a new, equal array
    eq(other) {
        this.a.set(other.a);
        return this;
    }
    // Set this array to zero.
    // From this, the codegen will produce...
    // zeroeq()     // the same thing but with eq at the end
    // zero()       // constructs a zero of the same type as `this`
    // IndirectArray.Zero() // static zero constructor
    eqZero() {
        this.a.fill(0);
        return this;
    }
});

// Vector methods that can be written in coordinate-free
// fashion, without reference to anything but the generic
// methods like `add`, `mul`, and `dot`.
const AbstractVecN = generateVariantMethods(
class AbstractVecN extends IndirectArray {
    // R^n -> R
    // Vector magnitude
    mag() {
        return Math.sqrt(this.dot(this));
    }
    // R^n -> R
    // Vector magnitude squared
    mag2() {
        return this.dot(this);
    }
    // R^n -> (R -> R) -> R^n
    // Calls `magnitude_function` on the magnitude of the input vector,
    // and creates a vector with the same direction, but with the new,
    // returned magnitude.
    // DO NOT USE WITH CLOSURES OR ARROW FUNCTIONS - IT WILL ALLOCATE
    //    A NEW CLOSURE WITH EVERY CALL!!! 
    // Example usage:
    //    function inverse_square(r) {return 6.674/(r*r)}
    //    force.eqmapmag(p2.sub(p1),inverse_square)
    //    force.muleq(m1*m2); // Newtonian graviation
    eqMapMag(self,magnitude_function) {
        const mag = self.mag();
        if (mag === 0.0) { // This is a safe function!
            return this.eqzero(); // f(0) always makes vec 0
        }
        const new_mag = magnitude_function(mag);
        const ratio = new_mag / mag;
        return this.eqMul(self,ratio);
    }
});

// A one-dimensional vector
const Vec1 = generateVariantMethods(
class Vec1 extends AbstractVecN {
    static TYPE = Float32Array;
    static SIZE = 1;
    get x() {return this.a[0]};
    set x(v){this.a[0] = v};
    // Set the components of this vector
    // From this, the codegen will produce...
    // fromeq(x)     // the same thing but with eq at the end
    // from(x)       // constructs a vector of the same type as `this`
    // IndirectArray.From() // component constructor
    eqFrom(x) {
        this.a[0] = x;
        return this;
    }
    // Set to X unit vector
    eqXhat() {
        this.a[0] = 1;
        return this;
    }
    // Scalar multiplication
    eqMul(self,scalar) {
        this.a[0] = self.a[0] * scalar;
        return this;
    }
    // Vector addition
    eqAdd(self,other) {
        this.a[0] = self.a[0] + other.a[0];
        return this;
    }
    // Dot product
    dot(other) {
        return this.a[0] * other.a[0];
    }
});

// A two-dimensional vector
const Vec2 = generateVariantMethods(
class Vec2 extends AbstractVecN {
    static TYPE = Float32Array;
    static SIZE = 2;
    get x() {return this.a[0]};
    set x(v){this.a[0] = v};
    get y() {return this.a[1]};
    set y(v){this.a[1] = v};
    // Rotation, specific to vec2
    eqRotate(self,theta) {
        const [out,a] = [this.a,self.a];
        const [c,s] = [Math.cos(theta),Math.sin(theta)];
        const out0 = c*a[0] + s*a[1];
        out[1]     = s*a[0] - c*a[1];
        out[0] = out0;
        return this;
    }
    
    // Set the components of this vector
    eqFrom(x,y) {
        this.a[0] = x;
        this.a[1] = y;
        return this;
    }
    // Set to X or Y unit vector
    eqXhat() {this.zeroEq();this.a[0] = 1;return this;}
    eqYhat() {this.zeroEq();this.a[1] = 1;return this;}
    // Scalar multiplication
    eqMul(self,scalar) {
        const [out,a] = [this.a,self.a];
        out[0] = a[0] * scalar;
        out[1] = a[1] * scalar;
        return this;
    }
    // Vector addition
    eqAdd(self,other) {
        const [out,a,b] = [this.a,self.a,other.a];
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        return this;
    }
    // Dot product
    dot(other) {
        const [a,b] = [this.a,other.a];
        return a[0] * b[0] +
               a[1] * b[1];
    }
});

// A three-dimensional vector
const Vec3 = generateVariantMethods(
class Vec3 extends AbstractVecN {
    static TYPE = Float32Array;
    static SIZE = 3;
    get x() {return this.a[0]};
    set x(v){this.a[0] = v};
    get y() {return this.a[1]};
    set y(v){this.a[1] = v};
    get z() {return this.a[2]};
    set z(v){this.a[2] = v};
    // Set the components of this vector
    eqFrom(x,y,z) {
        this.a[0] = x;
        this.a[1] = y;
        this.a[2] = z;
        return this;
    }
    // Set to X or Y unit vector
    eqXhat() {this.zeroEq();this.a[0] = 1;return this;}
    eqYhat() {this.zeroEq();this.a[1] = 1;return this;}
    eqZhat() {this.zeroEq();this.a[2] = 1;return this;}
    // Scalar multiplication
    eqMul(self,scalar) {
        const [out,a] = [this.a,self.a];
        out[0] = a[0] * scalar;
        out[1] = a[1] * scalar;
        out[2] = a[2] * scalar;
        return this;
    }
    // Vector addition
    eqAdd(self,other) {
        const [out,a,b] = [this.a,self.a,other.a];
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        return this;
    }
    // Dot product
    dot(other) {
        const [a,b] = [this.a,other.a];
        return a[0] * b[0] +
               a[1] * b[1] +
               a[2] * b[2];
    }
});

// A four-dimensional vector
const Vec4 = generateVariantMethods(
class Vec4 extends AbstractVecN {
    static TYPE = Float32Array;
    static SIZE = 4;
    get x() {return this.a[0]};
    set x(v){this.a[0] = v};
    get y() {return this.a[1]};
    set y(v){this.a[1] = v};
    get z() {return this.a[2]};
    set z(v){this.a[2] = v};
    get w() {return this.a[3]};
    set w(v){this.a[3] = v};
    // Set the components of this vector
    eqFrom(x,y,z,w) {
        this.a[0] = x;
        this.a[1] = y;
        this.a[2] = z;
        this.a[3] = w;
        return this;
    }
    // Set to X or Y unit vector
    eqXhat() {this.zeroEq();this.a[0] = 1;return this;}
    eqYhat() {this.zeroEq();this.a[1] = 1;return this;}
    eqZhat() {this.zeroEq();this.a[2] = 1;return this;}
    eqWhat() {this.zeroEq();this.a[3] = 1;return this;}
    // Scalar multiplication
    eqMul(self,scalar) {
        const [out,a] = [this.a,self.a];
        out[0] = a[0] * scalar;
        out[1] = a[1] * scalar;
        out[2] = a[2] * scalar;
        out[3] = a[3] * scalar;
        return this;
    }
    // Vector addition
    eqAdd(self,other) {
        const [out,a,b] = [this.a,self.a,other.a];
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        out[3] = a[3] + b[3];
        return this;
    }
    // Dot product
    dot(other) {
        const [a,b] = [this.a,other.a];
        return a[0] * b[0] +
               a[1] * b[1] +
               a[2] * b[2] +
               a[3] * b[3];
    }
});

// Integer vectors
class Vec1I extends Vec1 {
    static TYPE = Int32Array;
}
class Vec2I extends Vec2 {
    static TYPE = Int32Array;
}
class Vec3I extends Vec3 {
    static TYPE = Int32Array;
}
class Vec4I extends Vec4 {
    static TYPE = Int32Array;
}

GL_TYPE_CODES = {
    BOOL : Vec1I,
    BOOL_VEC2 : Vec2I,
    BOOL_VEC3 : Vec3I,
    BOOL_VEC4 : Vec4I,
    BYTE :  Vec1I,
    FLOAT : Vec1,
    FLOAT_MAT2 : null, // NOT IMPLEMENTED
    FLOAT_MAT3 : null, // NOT IMPLEMENTED
    FLOAT_MAT4 : null, // NOT IMPLEMENTED
    FLOAT_VEC2 : Vec2,
    FLOAT_VEC3 : Vec3,
    FLOAT_VEC4 : Vec4,
    INT      : Vec1I,
    INT_VEC2 : Vec2I,
    INT_VEC3 : Vec3I,
    INT_VEC4 : Vec4I,
    // No vector types for these.
    // Samplers don't appear in attributes,
    // and they will be handled differently in uniforms
    SAMPLER_2D : null,
    SAMPLER_CUBE : null,
    // The types below are not even in GLSL.
    SHORT : null,
    UNSIGNED_BYTE : null,
    UNSIGNED_INT : null,
    UNSIGNED_SHORT : null,
}

__testVectorCode();
