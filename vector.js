'use strict'
// The math of Euclidian space.
// Heavy use of automatic code generation inside.

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
    for (const name of Reflect.ownKeys(Class.prototype)) {
        // Check to see if it's a static method 
        // (instance methods don't show up on classes, so
        //  any functions we see here are static methods.)
        const value = Reflect.get(Class.prototype,name);
        if (value instanceof Function
            && IS_EQ_FUNCTION.test(name)) {
            console.log(name,value,extractArgs(value));
        }
    }
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
        return other.a instanceof this.TYPE &&
               other.a.length == this.a.length;
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
    // Set this array to zero.
    // From this, the codegen will produce...
    // zeroeq()     // the same thing but with eq in front
    // zero()       // constructs a zero of the same type as `this`
    // IndirectArray.Zero() // static zero constructor
    eqzero() {
        this.a.fill(a.fill(0));
    }
});
