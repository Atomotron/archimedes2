'use strict'
// The math of Euclidian space.

// An indirect wrapper of a typed array.
//
// All of the math types in this engine are stored as pointers to
// typed arrays. This is necessary so that the underlying memory
// can be re-allocated when buffers must be resized, without invalidating
// all of the objects being passed around. Buffer managers, if they
// will ever 
class IndirectArray {
    // The typechecking method will verify that the array pointer `a`
    // points to a typed array that is an instance of `TYPE,` and has
    // length `SIZE.` These should be overriden in subclasses.
    TYPE = null;
    SIZE = null;
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
    // This will result in a zero-filled instance of the subclass.
    // Example use:
    //     IndirectArray.Default();
    static Default() {
        return new this(this.TYPE(this.SIZE));
    }
    // Set an indirect array to zero.
    static Zero(out) {
        return out.a.fill(out,0);
    }
}


