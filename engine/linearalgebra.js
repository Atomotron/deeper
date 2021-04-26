import {extractArgs} from './util.js';

export {Vec1,Vec2,Vec3,Vec4,
        Vec1I,Vec2I,Vec3I,Vec4I,
        Mat2,Mat3,Mat4,};
export {GL_TYPE_INDIRECT_ARRAYS};

// This implements the "fourfold interface" of the vector and matrix classes.
// Starting with a function of the form eqFoo, it will produce foo, static Foo,
// and the updating assignment method (i.e. like += or *=) fooEq.
function generateVariantMethods(Class) {
    const IS_EQ_FUNCTION = /^eq.*/;
    function attachMethod(target,name,args,method_string) {
        Reflect.defineProperty(target,name,
        {
            configurable: true,
            writable: true,
            enumerable: false,
            value: Function(...args,method_string),
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
                const outer_args = replace(args,'self',null);
                const inner_args = replace(args,'self','this');
                attachMethod(Class.prototype,method_name,outer_args,
                    `return this.${name}(${inner_args.join(',')});`);
            }
            // Generate x__ method that constructs a new `this` to use as output
            // and that uses `this` as the self-argument.
            // Example: a.add(b) --> (new vector).eqadd(a,b)
            if (base_name !== '') {
                const method_name = lowerFirst(base_name);
                const outer_args = replace(args,'self',null);
                const inner_args = replace(args,'self','this');
                attachMethod(Class.prototype,method_name,outer_args,
`const constructed = this.constructor.Default();
return constructed.${name}(${inner_args.join(',')});`);
            }
            // Generate static X__ method that constructs a new `this`
            // but otherwise behaves like the eq__ method.
            // Example: Vec2.Add(a,b) --> (new vector).eqadd(a,b)
            if (base_name !== '') {
                const method_name = upperFirst(base_name);
                const outer_args = args;
                const inner_args = args;
                // Attaching to Class makes it static
                attachMethod(Class,method_name,outer_args, 
`const constructed = this.Default();
return constructed.${name}(${inner_args.join(',')});`);
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
    TYPE = null;
    SIZE = null;
    static TYPE() {return null}
    static SIZE() {return null}
    // Constructor that allocates a new array (all zeros)
    static Default() {
        return new this( new (this.TYPE()) (this.SIZE()) )
    }    
    // The constructor takes the array that should be stored and does not
    // allocate. That's because often the backing array will come from a
    // slice of another array.
    constructor(a) {
        this.a = a;
    }
    // Check to see if a typed array is binary-compatible with our type.
    // In other words, this ensures that it has the right size and type.
    is_compatible(array) {
        return array instanceof this.TYPE &&
               array.length == this.SIZE;
    }
    // Returns true iff this.a matches this.TYPE and this.SIZE.
    typecheck() {
        return this.is_compatible(this.a);
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

// Vector methods that are generic over all vector lengths.
const AbstractVecN = generateVariantMethods(
class AbstractVecN extends IndirectArray {
    // GENERIC METHODS (override these in small-size subclasses)
    // due to inlining size limitations, you might not want to
    // bother overriding them in large-size vectors.
    eqFrom(...numbers) {
        const count = Math.min(this.SIZE,numbers.length);
        for (let i=0; i<count; ++i) {
            this.a[i] = numbers[i];
        }
        return this;
    }
    // Default n-ary vector addition
    eqAdd(self,other) {
        for (let i=0; i<this.SIZE; ++i) {
            this.a[i] = self.a[i] + other.a[i];
        }
        return this;
    }
    // Default n-ary vector subtraction
    eqSub(self,other) {
        for (let i=0; i<this.SIZE; ++i) {
            this.a[i] = self.a[i] - other.a[i];
        }
        return this;
    }
    // Default n-ary scalar multiplication
    eqMul(self,scalar) {
        for (let i=0; i<this.SIZE; ++i) {
            this.a[i] = self.a[i] * scalar;
        }
        return this;
    }
    // Clamps between 0 and 1
    eqClamp(self) {
        for (let i=0; i<this.SIZE; ++i) {
            let c = self.a[i];
            if (c > 1) c = 1;
            if (c < 0) c = 0;
            this.a[i] = c;
        }
    }
    // Default n-ary dot product
    dot(other) {
        let sum = Math.fround(0.0);
        for (let i=0; i<this.constructor.SIZE; ++i) {
            sum = Math.fround(sum + Math.fround(this.a[i] * other.a[i]));
        }
        return sum;
    }
    
    // COORDINATE-FREE METHODS (which won't be overriden)
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
    // R^n -> R^n
    // Normalizes (makes unit-length) the input vector
    // Returns a zero-length vector if given a zero-length vector.
    eqNorm(self) {
        const mag = self.mag();
        if (mag === 0.0) { // This is a safe function!
            return this.eqZero(); // f(0) always makes vec 0
        }
        return this.eqMul(self,1.0 / mag);
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
            return this.eqZero(); // f(0) always makes vec 0
        }
        const new_mag = magnitude_function(mag);
        const ratio = new_mag / mag;
        return this.eqMul(self,ratio);
    } 
    // Produces a friendly string representation of the vector
    toString() {
        // Formats a square TypedArray matrix, as stored in this.a
        const array = this.a;
        const n = this.a.length;
        let longest = 0;
        const row = 
            Array.from(array).map(x => {
                const s = x.toFixed(3);
                if (longest < s.length) longest = s.length;
                return s;
            });
        const line = [];
        for (const x of row) {
            line.push(' '.repeat(1 + longest - x.length) + x);
        }
        return `Vec${n}[${line.join(',')}]`;
    }
});

// A one-dimensional vector
const Vec1 = generateVariantMethods(
class Vec1 extends AbstractVecN {
    TYPE = Float32Array;
    SIZE = 1;
    static TYPE() {return Float32Array}
    static SIZE() {return 1}
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
    // Vector subtraction
    eqSub(self,other) {
        this.a[0] = self.a[0] - other.a[0];
        return this;
    }
    // Dot product
    dot(other) {
        return Math.fround(this.a[0] * other.a[0]);
    }
});

// A two-dimensional vector
const Vec2 = generateVariantMethods(
class Vec2 extends AbstractVecN {
    TYPE = Float32Array;
    SIZE = 2;
    static TYPE() {return Float32Array}
    static SIZE() {return 2}
    get x() {return this.a[0]};
    set x(v){this.a[0] = v};
    get y() {return this.a[1]};
    set y(v){this.a[1] = v};
    // Rotation, specific to vec2
    eqRotate(self,theta) {
        const out=this.a, a=self.a;
        const c=Math.cos(theta), s=Math.sin(theta);
        const out0 = c*a[0] - s*a[1];
        out[1]     = s*a[0] + c*a[1];
        out[0] = out0;
        return this;
    }
    // Polar coordinate setter
    eqPolar(self,r,theta) {
        this.a[0] = r*Math.cos(theta);
        this.a[1] = r*Math.sin(theta);
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
        const out=this.a, a=self.a;
        out[0] = a[0] * scalar;
        out[1] = a[1] * scalar;
        return this;
    }
    // Vector addition
    eqAdd(self,other) {
        const out=this.a, a=self.a, b=other.a;
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        return this;
    }
    // Scaled vector addition
    eqScaledAdd(self,other,scale) {
        const out=this.a, a=self.a, b=other.a;
        out[0] = a[0] + b[0]*scale;
        out[1] = a[1] + b[1]*scale;
        return this;
    }
    // Vector subtraction
    eqSub(self,other) {
        const out=this.a, a=self.a, b=other.a;
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        return this;
    }
    // Dot product
    dot(other) {
        const a=this.a, b=other.a;
        return Math.fround(a[0] * b[0]) +
               Math.fround(a[1] * b[1]);
    }
    // Matrix transformation
    eqTransform(self,matrix) {
        const o = this.a, x = self.a, a = matrix.a;
        const a00 = a[0],a10 = a[1],a01 = a[2],a11 = a[3];
        const x0 = x[0], x1 = x[1];
        o[0] = a00*x0 + a01*x1;
        o[1] = a10*x0 + a11*x1;
        return this;
    }
    // Distance squared
    distance2(other) {
        const dx = this.a[0] - other.a[0];
        const dy = this.a[1] - other.a[1];
        return dx*dx + dy*dy;
    }
});

// A three-dimensional vector
const Vec3 = generateVariantMethods(
class Vec3 extends AbstractVecN {
    TYPE = Float32Array;
    SIZE = 3;
    static TYPE() {return Float32Array}
    static SIZE() {return 3}
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
        const out=this.a, a=self.a;
        out[0] = a[0] * scalar;
        out[1] = a[1] * scalar;
        out[2] = a[2] * scalar;
        return this;
    }
    // Vector addition
    eqAdd(self,other) {
        const out=this.a, a=self.a, b=other.a;
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        return this;
    }
    // Vector subtraction
    eqSub(self,other) {
        const out=this.a, a=self.a, b=other.a;
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        return this;
    }
    // Dot product
    dot(other) {
        const a=this.a, b=other.a;;
        return Math.fround(a[0] * b[0]) +
               Math.fround(a[1] * b[1]) +
               Math.fround(a[2] * b[2]);
    }
    // Matrix transformation
    eqTransform(self,matrix) {
        const o = this.a, x = self.a, a = matrix.a;
        const a00=a[0],a01=a[3],a02=a[6],
              a10=a[1],a11=a[4],a12=a[7],
              a20=a[2],a21=a[5],a22=a[8];
        const x0 = x[0], x1 = x[1], x2 = x[2];
        o[0] = a00*x0 + a01*x0 + a02*x0;
        o[1] = a10*x0 + a11*x0 + a12*x0;
        o[2] = a20*x0 + a21*x0 + a22*x0;
        return this;
    }
});

// A four-dimensional vector
const Vec4 = generateVariantMethods(
class Vec4 extends AbstractVecN {
    TYPE = Float32Array;
    SIZE = 4;
    static TYPE() {return Float32Array}
    static SIZE() {return 4}
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
        const out=this.a, a=self.a;
        out[0] = a[0] * scalar;
        out[1] = a[1] * scalar;
        out[2] = a[2] * scalar;
        out[3] = a[3] * scalar;
        return this;
    }
    // Vector addition
    eqAdd(self,other) {
        const out=this.a, a=self.a, b=other.a;
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        out[3] = a[3] + b[3];
        return this;
    }
    // Vector subtraction
    eqSub(self,other) {
        const out=this.a, a=self.a, b=other.a;
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        out[3] = a[3] - b[3];
        return this;
    }
    // Dot product
    dot(other) {
        const a=this.a, b=other.a;;
        return Math.fround(a[0] * b[0]) +
               Math.fround(a[1] * b[1]) +
               Math.fround(a[2] * b[2]) +
               Math.fround(a[3] * b[3]);
    }
    // Matrix transformation
    eqTransform(self,matrix) {
        const o = this.a, x = self.a, a = matrix.a;
        const a00=a[0],a01=a[4],a02=a[8], a03=a[12],
              a10=a[1],a11=a[5],a12=a[9], a13=a[13],
              a20=a[2],a21=a[6],a22=a[10],a23=a[14],
              a30=a[3],a31=a[7],a32=a[11],a33=a[15];
        const x0 = x[0], x1 = x[1], x2 = x[2], x3 = x[3];
        o[0] = a00*x0 + a01*x1 + a02*x2 + a03*x3;
        o[1] = a10*x0 + a11*x1 + a12*x2 + a13*x3;
        o[2] = a20*x0 + a21*x1 + a22*x2 + a23*x3;
        o[3] = a30*x0 + a31*x1 + a32*x2 + a33*x3;
        return this;
    }
});

// A nine-dimensional vector, made especially for Mat3.
// Uses default (iterative) implementations.
const Vec9 = generateVariantMethods(
class Vec9 extends AbstractVecN {
    TYPE = Float32Array;
    SIZE = 9;
    static TYPE() {return Float32Array}
    static SIZE() {return 9}
});

// A sixteen-dimensional vector, made especially for Mat4.
// Uses default (iterative) implementations.
const Vec16 = generateVariantMethods(
class Vec16 extends AbstractVecN {
    TYPE = Float32Array;
    SIZE = 16;
    static TYPE() {return Float32Array}
    static SIZE() {return 16}
});

// Integer vectors
// Note: By extending AbstractVecN, we won't
//       polymorphize the highly optimized instance
//       methods for addition and that kind of thing.
class Vec1I extends AbstractVecN {
    TYPE = Int32Array;
    SIZE = 1;
    static TYPE() {return Int32Array}
    static SIZE() {return 1}
}
class Vec2I extends AbstractVecN {
    TYPE = Int32Array;
    SIZE = 2;
    static TYPE() {return Int32Array}
    static SIZE() {return 2}
}
class Vec3I extends AbstractVecN {
    TYPE = Int32Array;
    SIZE = 3;
    static TYPE() {return Int32Array}
    static SIZE() {return 3}
}
class Vec4I extends AbstractVecN {
    TYPE = Int32Array;
    SIZE = 4;
    static TYPE() {return Int32Array}
    static SIZE() {return 4}
}

/*****************************************************************************/
/**                                MATRICES                                 **/
/*****************************************************************************/

// The abstract Matrix class is written as a mixin so that 
// the matrix classes can extend both it and their corresponding
// vector classes.
const AbstractMatMixin = (Base) => generateVariantMethods(
class extends Base {
    // Computes the inverse of the given matrix
    eqInverse(self) {
        const det = self.determinant();
        if (det === 0.0) {
            // Singular matrix
            return this.eqZero();
        }
        this.eqAdjugate(self);
        return this.mulEq(1.0 / det);
    }
    toString() {
        // Formats a square TypedArray matrix, as stored in this.a
        const array = this.a;
        const n = Math.sqrt(this.a.length);
        const rows = [];
        let longest = 0;
        for (let row=0; row<n; ++row) {
            const slice = Array.from(array.slice(n*row,n*(row+1)));
            rows.push(
                slice.map(x => {
                    const s = x.toFixed(3);
                    if (longest < s.length) longest = s.length;
                    return s;
                })
            );
        }
        const lines = [`${n}×${n} Matrix`];
        for (const row of rows) {
            const line = [];
            for (const x of row) {
                line.push(' '.repeat(1 + longest - x.length) + x);
            }
            lines.push(`[${line.join(',')}]`);
        }
        return lines.join('\n');
    }
});

// 2D Matrix type
const Mat2 = generateVariantMethods(
class Mat2 extends AbstractMatMixin(Vec4) {
    get a00() {return this.a[0]};
    set a00(v){this.a[0] = v};
    get a10() {return this.a[1]};
    set a10(v){this.a[1] = v};
    
    get a10() {return this.a[2]};
    set a10(v){this.a[2] = v};
    get a11() {return this.a[3]};
    set a11(v){this.a[3] = v};
    // Identity matrix
    eqId() {
        const o = this.a;
        o[0] = 1.0; o[2] = 0.0;
        o[1] = 0.0; o[3] = 1.0;
        return this;
    }
    // Construct default instance - the identity
    static Default() {
        const a = new (this.TYPE())(this.SIZE());
        a[0] = 1.0;
        a[2] = 1.0;
        return new this(a);
    }
    // Composition with an argument-specified matrix
    eqComposeFrom(self,b00,b01,
                       b10,b11) {
        const o = this.a, a = self.a;
        const a00 = a[0],a01 = a[2],
              a10 = a[1],a11 = a[3];
        o[0] = a00 * b00 + a01 * b10; //o00
        o[1] = a10 * b00 + a11 * b10; //o10
        o[2] = a00 * b01 + a01 * b11; //o01
        o[3] = a10 * b01 + a11 * b11; //o11
        return this;
    }
    // Rotate matrix. Compose with identity constructor to construct
    //                a new matrix.
    eqRotate(self,theta) {
        return this.eqComposeFrom(self,
            Math.cos(theta), -Math.sin(theta),
            Math.sin(theta),  Math.cos(theta),
        );
    }
    // Matrix multiplication (composition of transformation)
    eqCompose(self,other) {
        const b = other.a;
        return this.eqComposeFrom(self, 
            b[0],b[2],
            b[1],b[3],
        );        
    }
    // Determinant (equal to product of all eigenvalues)
    determinant() {
        const a = this.a;
        return a[0] * a[3] - a[1] * a[2];
    }
    // Adjugate
    eqAdjugate(self) {
        const o = this.a,a = self.a;
        const a0 = a[0];
        o[0] = a[3];
        o[1] = -a[1];
        o[2] = -a[2];
        o[3] = a0;
        return this;
    }
});

// 3D Matrix type
const Mat3 = generateVariantMethods(
class Mat3 extends AbstractMatMixin(Vec9) {
    get a00() {return this.a[0]};
    set a00(v){this.a[0] = v};
    get a10() {return this.a[1]};
    set a10(v){this.a[1] = v};
    get a20() {return this.a[2]};
    set a20(v){this.a[2] = v};
    
    get a10() {return this.a[3]};
    set a10(v){this.a[3] = v};
    get a11() {return this.a[4]};
    set a11(v){this.a[4] = v};
    get a12() {return this.a[5]};
    set a12(v){this.a[5] = v};
    
    get a20() {return this.a[6]};
    set a20(v){this.a[6] = v};
    get a21() {return this.a[7]};
    set a21(v){this.a[7] = v};
    get a22() {return this.a[8]};
    set a22(v){this.a[8] = v};
    // Identity matrix
    eqId() {
        const o = this.a;
        o[0] = 1.0; o[3] = 0.0; o[6] = 0.0; 
        o[1] = 0.0; o[4] = 1.0; o[7] = 0.0;
        o[2] = 0.0; o[5] = 0.0; o[8] = 1.0;
        return this;
    }
    // Construct default instance - the identity
    static Default() {
        const a = new (this.TYPE())(this.SIZE());
        a[0] = 1.0;
        a[4] = 1.0;
        a[8] = 1.0;
        return new this(a);
    }
    // Composition with an argument-specified matrix
    eqComposeFrom(self,b00,b01,b02,
                       b10,b11,b12,
                       b20,b21,b22,) {
        const a=self.a,o=this.a;
        const a00=a[0],a01=a[3],a02=a[6],
              a10=a[1],a11=a[4],a12=a[7],
              a20=a[2],a21=a[5],a22=a[8];

        const o00 = b00 * a00 + b01 * a10 + b02 * a20;
        const o01 = b00 * a01 + b01 * a11 + b02 * a21;
        const o02 = b00 * a02 + b01 * a12 + b02 * a22;
        const o10 = b10 * a00 + b11 * a10 + b12 * a20;
        const o11 = b10 * a01 + b11 * a11 + b12 * a21;
        const o12 = b10 * a02 + b11 * a12 + b12 * a22;
        const o20 = b20 * a00 + b21 * a10 + b22 * a20;
        const o21 = b20 * a01 + b21 * a11 + b22 * a21;
        const o22 = b20 * a02 + b21 * a12 + b22 * a22;
        
        o[0]=o00; o[3]=o01; o[6]=o02;
        o[1]=o10; o[4]=o11; o[7]=o12;
        o[2]=o20; o[5]=o21; o[8]=o22;
        return this;
    }
    // Matrix multiplication (composition of transformation)
    eqCompose(self,other) {
        const b = other.a;
        return this.eqComposeFrom(self, 
            b[0],b[3],b[6],
            b[1],b[4],b[7],
            b[2],b[5],b[8],
        );
    }
    // Determinant (equal to product of all eigenvalues)
    determinant() {
        const a = this.a;
        const a00=a[0],a01=a[1],a02=a[2],
              a10=a[3],a11=a[4],a12=a[5],
              a20=a[6],a21=a[7],a22=a[8];
        return (
            a00 * (a22 * a11 - a12 * a21) +
            a01 * (-a22 * a10 + a12 * a20) +
            a02 * (a21 * a10 - a11 * a20)
        );
    }
    // Adjugate
    eqAdjugate(self) {
        const o = this.a,a = self.a;
        const a00=a[0],a01=a[1],a02=a[2],
              a10=a[3],a11=a[4],a12=a[5],
              a20=a[6],a21=a[7],a22=a[8];
        const o00 = a11 * a22 - a12 * a21;
        const o01 = a02 * a21 - a01 * a22;
        const o02 = a01 * a12 - a02 * a11;
        const o10 = a12 * a20 - a10 * a22;
        const o11 = a00 * a22 - a02 * a20;
        const o12 = a02 * a10 - a00 * a12;
        const o20 = a10 * a21 - a11 * a20;
        const o21 = a01 * a20 - a00 * a21;
        const o22 = a00 * a11 - a01 * a10;
        
        o[0]=o00; o[3]=o01; o[6]=o02;
        o[1]=o10; o[4]=o11; o[7]=o12;
        o[2]=o20; o[5]=o21; o[8]=o22;
        return this;
    }
});

// 4D Matrix type
const Mat4 = generateVariantMethods(
class Mat4 extends AbstractMatMixin(Vec16) {
    get a00() {return this.a[0]};
    set a00(v){this.a[0] = v};
    get a10() {return this.a[1]};
    set a10(v){this.a[1] = v};
    get a20() {return this.a[2]};
    set a20(v){this.a[2] = v};
    get a30() {return this.a[3]};
    set a30(v){this.a[3] = v};
    
    get a01() {return this.a[4]};
    set a01(v){this.a[4] = v};
    get a11() {return this.a[5]};
    set a11(v){this.a[5] = v};
    get a21() {return this.a[6]};
    set a21(v){this.a[6] = v};
    get a31() {return this.a[7]};
    set a31(v){this.a[7] = v};
    
    get a02() {return this.a[8]};
    set a02(v){this.a[8] = v};
    get a12() {return this.a[9]};
    set a12(v){this.a[9] = v};
    get a22() {return this.a[10]};
    set a22(v){this.a[10] = v};
    get a32() {return this.a[11]};
    set a32(v){this.a[11] = v};
    
    get a03() {return this.a[12]};
    set a03(v){this.a[12] = v};
    get a13() {return this.a[13]};
    set a13(v){this.a[13] = v};
    get a23() {return this.a[14]};
    set a23(v){this.a[14] = v};
    get a33() {return this.a[15]};
    set a33(v){this.a[15] = v};
    // Identity matrix
    eqId() {
        const o = this.a;
        o[0] = 1.0; o[1] = 0.0; o[2] = 0.0; o[3] = 0.0;
        o[4] = 0.0; o[5] = 1.0; o[6] = 0.0; o[7] = 0.0;
        o[8] = 0.0; o[9] = 0.0; o[10] = 1.0; o[11] = 0.0;
        o[12] = 0.0; o[13] = 0.0; o[14] = 0.0; o[15] = 1.0;
        return this;
    }
    // Construct default instance - the identity
    static Default() {
        const a = new (this.TYPE())(this.SIZE());
        a[0] = 1.0;
        a[5] = 1.0;
        a[10] = 1.0;
        a[15] = 1.0;
        return new this(a);
    }
    // Composition with an argument-specified matrix
    eqComposeFrom(self,
        b00,b01,b02,b03,
        b10,b11,b12,b13,
        b20,b21,b22,b23,
        b30,b31,b32,b33,) {
        const o = this.a, a = self.a;
        const a00=a[0],a01=a[4],a02=a[8], a03=a[12],
              a10=a[1],a11=a[5],a12=a[9], a13=a[13],
              a20=a[2],a21=a[6],a22=a[10],a23=a[14],
              a30=a[3],a31=a[7],a32=a[11],a33=a[15];
        const o00 = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30; //o00
        const o01 = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31; //o01
        const o02 = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32; //o02
        const o03 = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33; //o03
        
        const o10 = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30; //o10
        const o11 = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31; //o11
        const o12 = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32; //o12
        const o13 = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33; //o13
        
        const o20 = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30; //o20
        const o21 = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31; //o21
        const o22 = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32; //o22
        const o23 = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33; //o23
        
        const o30 = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30; //o30
        const o31 = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31; //o31
        const o32 = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32; //o32
        const o33 = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33; //o33

        o[0]=o00; o[4]=o01; o[8]=o02; o[12]=o03;
        o[1]=o10; o[5]=o11; o[9]=o12; o[13]=o13;
        o[2]=o20; o[6]=o21; o[10]=o22; o[14]=o23;
        o[3]=o30; o[7]=o31; o[11]=o32; o[15]=o33;
        return this;
    }
    // Matrix multiplication (composition of transformation)
    eqCompose(self,other) {
        const b = other.a;
        return this.eqComposeFrom(self, 
            b[0],b[4],b[8],b[12],
            b[1],b[5],b[9],b[13],
            b[2],b[6],b[10],b[14],
            b[3],b[7],b[11],b[15],
        );
    }
    // Determinant (equal to product of all eigenvalues)
    determinant() {
        const a = this.a;
        const a00=a[0],a01=a[4],a02=a[8], a03=a[12],
              a10=a[1],a11=a[5],a12=a[9], a13=a[13],
              a20=a[2],a21=a[6],a22=a[10],a23=a[14],
              a30=a[3],a31=a[7],a32=a[11],a33=a[15];
        const b0 = a00 * a11 - a01 * a10;
        const b1 = a00 * a12 - a02 * a10;
        const b2 = a01 * a12 - a02 * a11;
        const b3 = a20 * a31 - a21 * a30;
        const b4 = a20 * a32 - a22 * a30;
        const b5 = a21 * a32 - a22 * a31;
        const b6 = a00 * b5 - a01 * b4 + a02 * b3;
        const b7 = a10 * b5 - a11 * b4 + a12 * b3;
        const b8 = a20 * b2 - a21 * b1 + a22 * b0;
        const b9 = a30 * b2 - a31 * b1 + a32 * b0;

        // Calculate the determinant
        return a13 * b6 - a03 * b7 + a33 * b8 - a23 * b9;
    }
    // Adjugate
    eqAdjugate(self) {
        const o = this.a,a = self.a;
        const a00=a[0],a01=a[4],a02=a[8], a03=a[12],
              a10=a[1],a11=a[5],a12=a[9], a13=a[13],
              a20=a[2],a21=a[6],a22=a[10],a23=a[14],
              a30=a[3],a31=a[7],a32=a[11],a33=a[15];

        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        o00 = a11 * b11 - a12 * b10 + a13 * b09;
        o01 = a02 * b10 - a01 * b11 - a03 * b09;
        o02 = a31 * b05 - a32 * b04 + a33 * b03;
        o03 = a22 * b04 - a21 * b05 - a23 * b03;
        o10 = a12 * b08 - a10 * b11 - a13 * b07;
        o11 = a00 * b11 - a02 * b08 + a03 * b07;
        o12 = a32 * b02 - a30 * b05 - a33 * b01;
        o13 = a20 * b05 - a22 * b02 + a23 * b01;
        o20 = a10 * b10 - a11 * b08 + a13 * b06;
        o21 = a01 * b08 - a00 * b10 - a03 * b06;
        o22 = a30 * b04 - a31 * b02 + a33 * b00;
        o23 = a21 * b02 - a20 * b04 - a23 * b00;
        o30 = a11 * b07 - a10 * b09 - a12 * b06;
        o31 = a00 * b09 - a01 * b07 + a02 * b06;
        o32 = a31 * b01 - a30 * b03 - a32 * b00;
        o33 = a20 * b03 - a21 * b01 + a22 * b00;
        
        o[0]=o00; o[4]=o01; o[8]=o02; o[12]=o03;
        o[1]=o10; o[5]=o11; o[9]=o12; o[13]=o13;
        o[2]=o20; o[6]=o21; o[10]=o22; o[14]=o23;
        o[3]=o30; o[7]=o31; o[11]=o32; o[15]=o33;
        return this;
    }
});

// Maps type name to the indirect array class that can store that type.
const GL_TYPE_INDIRECT_ARRAYS = {
    BOOL : Vec1I,
    BOOL_VEC2 : Vec2I,
    BOOL_VEC3 : Vec3I,
    BOOL_VEC4 : Vec4I,
    BYTE :  Vec1I,
    FLOAT : Vec1,
    FLOAT_MAT2 : Mat2,
    FLOAT_MAT3 : Mat3,
    FLOAT_MAT4 : Mat4,
    FLOAT_VEC2 : Vec2,
    FLOAT_VEC3 : Vec3,
    FLOAT_VEC4 : Mat2, // NOTE: This works because Mat2 extends Vec4!!!
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
