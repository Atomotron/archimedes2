'use strict'
// The math of Euclidian space.

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
    return args;
}

// Very hacky codegen to implement `this.` methods.
// Example: Generates `add` and `addeq` from `static Add`.
// Every single math method will get these counterparts,
// so the codegen is worth it IMO.
// From static method `Xyy(*_out, ..., *_x , ...,)` we generate:
//     xyyeq(...) where `*_out` and `*_x` are both `this`
//     xyy(...)   where `*_out` is newly constructed and `*_x` is this
function generateInstanceMethodsFromStaticMethods(Class) {
    const IS_OUTPUT = /_out$/;  // write to this one
    const IS_SELF = /_x$/;      // use as this arg
    
    function codegen(Class,name,method_name,method_args,call_args) {
        const function_string = 
`function ${method_name} (${method_args.join(',')}) {
    return this.constructor.${name}(${call_args.join(',')});
}`;
        console.log(function_string);
        Reflect.defineProperty(Class.prototype,method_name,
        {
            configurable: true,
            writable: true,
            enumerable: false,
            value: eval(`(${function_string})`),
        });
    }
    
    for (const name of Reflect.ownKeys(Class)) {
        // Check to see if it's a static method 
        // (instance methods don't show up on classes, so
        //  any functions we see here are static methods.)
        const value = Reflect.get(Class,name);
        if (value instanceof Function) {
            console.log("Generating instance methods for",name); 
            // Map between argument name and argument index
            const args = extractArgs(value);
            let output_index = -1;
            let self_index = -1;
            const method_args = []; // args that will never be `this`
            for (let i=0; i<args.length; ++i) {
                if (output_index === -1 && 
                    IS_OUTPUT.test(args[i])) {
                    output_index = i;
                } else if (self_index === -1 && 
                           IS_SELF.test(args[i])) {
                    self_index = i;
                } else {
                    method_args.push(args[i]);
                }
            }
            console.log(output_index,self_index,method_args);
            // Codegen for scalar return functions (dot)
            if (output_index === -1 && self_index !== -1) {
                const call_args = args.slice();
                const method_name = name.toLowerCase();
                call_args[self_index] = 'this';
                codegen(Class,name,method_name,method_args,call_args);
            }
            // Codegen for in-place functions (addeq)
            else if (output_index !== -1) {
                const call_args = args.slice();
                const method_name = name.toLowerCase()+'eq';
                call_args[output_index] = 'this';
                if (self_index !== -1) {
                    call_args[self_index] = 'this';
                }
                codegen(Class,name,method_name,method_args,call_args);
            }
            // Codegen for freshly allocating functions (add)
            if (output_index !== -1 && self_index !== -1) {
                const call_args = args.slice();
                const method_name = name.toLowerCase();
                call_args[output_index] = 'this.constructor.Default()';
                call_args[self_index] = 'this';
                codegen(Class,name,method_name,method_args,call_args);
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
// all of the objects being passed around. Buffer managers, if they
// will ever 
const IndirectArray = generateInstanceMethodsFromStaticMethods(
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
        return other.a instanceof this.TYPE &&
               other.a.length == this.a.length;
    }
    // Returns true iff this.a matches this.TYPE and this.SIZE.
    typecheck() {
        return this.is_compatible(this);
    }    
    // This will result in a zero-filled instance of the subclass.
    // Example use:
    //     IndirectArray.Default();
    static Default() {
        console.log(this,this.TYPE);
        return new this(new this.TYPE(this.SIZE));
    }
    // Set an indirect array to zero.
    static Zero(array_out) {
        array_out.a.fill(0);
        return array_out;
    }
});

// This class implements vector methods that can be wholly defined in 
// terms of dimensionless, coordinateless sub-operators.
const AbstractVec = generateInstanceMethodsFromStaticMethods(
class AbstractVec extends IndirectArray {
    // R^n -> R
    // Vector magnitude
    static Mag(vector_x) {
        return Math.fround(
            Math.sqrt(this.Dot(vector_x,vector_x))
         );
    }
    // R^n -> (R -> R) -> R^n
    // Calls `magnitude_function` on the magnitude of the input vector,
    // and creates a vector with the same direction, but with the new,
    // returned magnitude.
    // DO NOT USE WITH CLOSURES OR ARROW FUNCTIONS - IT WILL ALLOCATE
    //    A NEW CLOSURE WITH EVERY CALL!!! 
    // Example usage:
    //    function inverse_square(r) {return 6.674/(r*r)}
    //    Vec2.MapMag(force,Vec2.Sub(p2,p1),inverse_square)
    //    Vec2.Mul(force,m1*m2); // Newtonian graviation
    static MapMag(vector_out,vector_x,magnitude_function) {
        const mag = this.Mag(vector_x);
        if (mag === 0.0) { // This is a safe function!
            return this.Zero(vector_out);
        }
        const new_mag = magnitude_function(mag);
        const ratio = new_mag / mag;
        return this.Mul(vector_out,ratio,vector_x);
    }
});

// A one-dimensional vector.
const Vec1 = generateInstanceMethodsFromStaticMethods(
class Vec1 extends AbstractVec {
    static TYPE = Float32Array;
    static SIZE = 1;
    // Create a Vec1 and set it to the argument.
    static Of(x) {
        const that = this.Default();
        that.a[0] = x;
        return that;
    }
    get x() {return this.a[0]};
    set x(v){this.a[0] = v};
    // R , R^n -> R^n
    // Scalar multiplication
    static Mul(vector_out,scalar,vector_x) {
        const [out,x,y] = [vector_out.a,vector_x.a,vector_y.a];
        out[0] = scalar * x[0];
    }
    // R^n , R^n -> R^n
    // Vector sum
    static Add(vector_out,vector_x,vector_y) {
        const [out,x,y] = [vector_out.a,vector_x.a,vector_y.a];
        out[0] = x[0] + y[0];
        return vector_out;
    }
    // R^n , R^n -> R
    // Dot product
    static Dot(vector_x,vector_y) {
        const [x,y] = [vector_x.a,vector_y.a];
        console.log('dotting',x,y);
        return x[0] * y[0];
    }
});
