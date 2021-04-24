// Management of VertexArrayObjects and VertexBufferObjects.
import {tabulate,isDefined,RingBuffer} from './util.js';
import {GL_TYPES} from './webgltypes.js';
import {AttributeSchema} from './shader.js';
import {GL_TYPE_INDIRECT_ARRAYS} from './linearalgebra.js';


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
    vertexAttribPointer(gl,buffer,divisor=0) {
        const FLOAT32_SIZEB = 4; // We only support f32 arrays
        const stride = this.structSize * FLOAT32_SIZEB;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
        // Loop once for every struct field we need to set up
        for (let i=0; i<this.names.length; i++) {
            const info = GL_TYPES[this.types[i]];
            const size = info.nelements / info.nattributes; // n components
            const offset = this.offsets[i] * FLOAT32_SIZEB;
            // Matrices fill multiple consecutive attribute locations.
            // This loop runs once for normal types, and N times for matN.
            for (let j=0; j<info.nattributes; j++) {
                gl.enableVertexAttribArray(this.attributeLocs[i]);
                gl.ANGLE_instanced_arrays
                  .vertexAttribDivisorANGLE(this.attributeLocs[i],divisor);
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
    toString(title="Vertex Buffer Schema") {
        const rows = [['ID','NAME','SIZE','OFFSET','TYPE','ATTR. LOC.']];
        for (let i=0; i<this.names.length; i++) {
            rows.push([
                i,this.names[i],this.sizes[i],this.offsets[i],
                GL_TYPES[this.types[i]].name,this.attributeLocs[i],
            ]);
        }
        return tabulate(title,rows);
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
    constructor(vbSchema,reserve=0,count=0) {
        this.sch = vbSchema;
        this.count = count;
        this.structs = [];
        this.array = new Float32Array(0);
        // The next size to grow to.
        if (count > reserve) reserve = count;
        this.nextSize = reserve*VertexBufferBacking.GROW_FACTOR || 1;
        // Initialize array
        this.growTo(reserve);
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
    sync(gl,backing) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        //console.log("Sync",backing,'with',this);
        if (backing.array.length !== this.size) {
            // We need to allocate new GPU memory
            //console.log("New allocation needed.");
            this.size = backing.array.length;
            gl.bufferData(
                gl.ARRAY_BUFFER,
                backing.array,
                this.usage,
            );
        } else {
            // This used to only upload a sub-array, but the allocation
            // of the sub-array was causing expensive full-pass cycle
            // garbage collections! It is better for performance to
            // always upload the entire array.
            gl.bufferSubData(
                gl.ARRAY_BUFFER, 
                0, // No dst offset
                backing.array,
            );
        }
        //console.log("Sync resulted in",this);
    }
}

export class VertexArraySchema {
    // attrSchema:  AttributeSchema from shader
    // divisors  :  Instanced drawing divisors (default 1)
    //              Map name -> divisor
    constructor(attributeSchema,divisors,stream) {
        // Organize by divisor
        const divisorGroups = new Map(); // divisor -> Set(names)
        for (const [name,divisor] of divisors) {
            const set = divisorGroups.get(divisor) || new Set();
            set.add(name);
            divisorGroups.set(divisor,set);
        }
        // Group stream flags by divisor
        // If any are stream, the whole buffer has to be stream.
        const streamDivisors = new Map(); // divisor -> are any stream?
        for (const [divisor,names] of divisorGroups) {
            let anyStream = false;
            for (const name of names) {
                if (stream.get(name)) {
                    anyStream = true;
                    break;
                }
            }
            streamDivisors.set(divisor,anyStream);
        }
        // Create attribute subschemas
        this.divisorIds = new Map();// divisor -> schema ID
        this.schemas = [];          // schema ID -> VertexBufferSchemas
        this.divisors = [];         // schema ID -> instance divisor
        this.stream = [];          // schema ID -> any stream?
        this.divisors = Array.from(divisorGroups.keys());
        this.divisors.sort(); // Always put lowest divisors first
        // Populate the above
        for (let i=0; i<this.divisors.length; i++) {
            const divisor = this.divisors[i];
            // Make subschema
            const sch = attributeSchema.subschema(divisorGroups.get(divisor));
            // Make VertexBufferSchema from subschema
            const vbs = new VertexBufferSchema(sch);
            // Populate internal structures
            this.divisorIds.set(divisor,i);
            this.schemas.push(vbs);
            this.stream.push(streamDivisors.get(divisor));
        }
    }
    sizeof(n,divisor=1) {
        return Math.ceil(n / divisor);
    }
    // Print schema for debugging and development purposes
    toString() {
        const lines = [`VertexArraySchema with ${this.divisors.length} divisor(s).`];
        for (let i=0; i<this.divisors.length; i++) {
            lines.push(this.schemas[i].toString(
                `Subschema ${i}, ` +
                `Divisor ${this.divisors[i]}, ` +
                (this.stream[i] ? 'Streaming' : 'Static')
            ));
        }
        return lines.join('\n\n');
    }
    // Sets up VAO, given a list of buffers corresponding to our list of divisors
    // Arguments:
    //  gl  : an active webgl context
    //  vertexBuffers: an array of VertexBuffers with a .buffer attribute
    //                 of type WebGLBuffer
    vertexAttribPointers(gl,vertexBuffers) {
        for (let i=0; i<this.divisors.length; i++) {
            const buf = vertexBuffers[i];
            const divisor = this.divisors[i];
            this.schemas[i].vertexAttribPointer(gl,buf,divisor);
        }
    }
}

export class VertexArrayBacking {
    // Arguments:
    //  vertexArraySchema: schema
    //  vertices         : number of divisor-0 slots to preallocate
    //  instances        : will preallocate to fit this many instances
    constructor(vertexArraySchema,vertices=0,instances=0) {
        this.sch = vertexArraySchema;
        // Set up vertex and instance backing
        this.vert = null;
        this.inst = null;
        this.buffers = [];
        this.divisors = [];
        this.fieldNames = [];
        for (let i=0; i<this.sch.schemas.length; i++) {
            const divisor = this.sch.divisors[i];
            const vbb = new VertexBufferBacking(
                this.sch.schemas[i],
                divisor > 0 ?
                    this.sch.sizeof(instances,divisor) : vertices,
            );
            this.divisors.push(divisor);
            this.buffers.push(vbb);
            const fieldName = this.nameAt(i);
            this.fieldNames.push(fieldName);
            this[fieldName] = vbb;
        }
    }
    nameAt(index) {
        const div = this.sch.divisors[index];
        if (div === 0) {
            return 'vert';
        } else if (div === 1) {
            return 'inst';
        } else {
            return `d${divisor}`;
        }
    }
    // Checks the count at divisor 0 to determine how many primitive vertices
    // can be drawn without overrunning the vertex buffer.
    countVertices() {
        return this.vert.count;
    }
    // Checks the count at each divisor level above 0 to compute the
    // number of instances that can be drawn without overruning any buffers.
    countInstances() {
        let n = null;
        // Note we're starting at i=1 (instances)
        for (let i=1; i < this.divisors.length; i++) {
            const divisor = this.divisors[i];
            const vbb = this.buffers[i];
            const instancesHere = divisor * vbb.count;
            // cut n down to be no greater than the number of instances
            // populated by this higher divisor
            if (n === null || n > instancesHere) n = instancesHere;
        }
        return n;
    }
    // Draws this VAO, using the number of vertices and indices stored here
    draw(gl,mode,vertexArray) {
        gl.OES_vertex_array_object
          .bindVertexArrayOES(vertexArray.vao);
        const v = this.vert === null ? 1 : this.countVertices();
        if (this.inst === null) {
            // uninstanced draw
            gl.drawArrays(
                mode, // geometry mode
                0,    // starting index
                v,    // number of indices to be rendered\
            );
        } else {
            const i = this.countInstances();
            if (i === 0) return; // No instances, nothing to draw.
            gl.ANGLE_instanced_arrays
              .drawArraysInstancedANGLE(
                mode, // geometry mode
                0,    // starting index
                v,    // number of indices to be rendered
                i,    // number of instances to execute
            );
        }
    }
}

// Represents a vertex array object
export class VertexArray {
    constructor(gl,vertexArraySchema,vertices=0,instances=0) {
        this.sch = vertexArraySchema;
        this.VBs = []; // vertex buffers
        // Construct vertex array buffers
        for (let i=0; i<this.sch.divisors.length; i++) {
            const divisor = this.sch.divisors[i];
            const hint = this.sch.stream[i] ? gl.STREAM_DRAW : gl.DYNAMIC_DRAW;
            if (divisor === 0) { //vertices
                this.VBs.push(new VertexBuffer(
                    gl,hint,vertices
                ));
            } else {
                this.VBs.push(new VertexBuffer(
                    gl,hint,this.sch.sizeof(instances,divisor)
                ));
            }
        }
        // Assemble VAO
        this.vao = gl.OES_vertex_array_object
                     .createVertexArrayOES();
        gl.OES_vertex_array_object
          .bindVertexArrayOES(this.vao);
        this.sch.vertexAttribPointers(gl,this.VBs);
    }
    destroy(gl) {
        // Note: You will have to destroy the buffers yourself.
        gl.OES_vertex_array_object
          .deleteVertexArray(this.vao);
    }
    // Syncronizes all internal buffers with buffer backing
    sync(gl,backing) {
        for (let i=0; i<backing.buffers.length; i++) {
            const vb = this.VBs[i];
            const vbb = backing.buffers[i];
            vb.sync(gl,vbb);
        }
    }
}

// Triple-buffered VAO/schema/backing collection
export class Geometry extends VertexArrayBacking {
    static RING_BUFFER_SIZE = 2; // Triple buffer
    constructor(gl,schema,vertices=0,instances=0) {
        // Parse configuration
        super(schema,vertices,instances);
        // Set up vertex arrays
        const VAs = [];
        for (let i=0; i<Geometry.RING_BUFFER_SIZE; i++) {
            VAs.push(new VertexArray(gl,this.sch,vertices,instances));
        }
        this.ring = new RingBuffer(VAs);
        // Set up dirty flags
        this.dirtyFlagNames = [];
        this.dirtyCounters = [];
        this.stream = this.sch.stream;
        for (let i=0; i<this.sch.schemas.length; i++) {
            const name = this.dirtyFlagNameAt(i);
            this.dirtyFlagNames.push(name);
            this[name] = false;
            this.dirtyCounters.push(Geometry.RING_BUFFER_SIZE);
        }
    }
    dirtyFlagNameAt(i) {
        return this.nameAt(i)+'Dirty';
    }
    // Sends updated data to the GPU.
    sync(gl) {
        this.ring.next();
        const vao = this.ring.top();
        for (let i=0; i < this.buffers.length; i++) {
            const dirtyFlagName = this.dirtyFlagNames[i];
            if (this[dirtyFlagName]) {
                this.dirtyCounters[i] = 3;
            } else {
                this[dirtyFlagName] = this.stream[i];
            }   
            // Change dirty flag depending on default behavior
            // If the dirty counter is still >0, we haven't updated all buffers
            if (this.dirtyCounters[i] > 0) {
                const backing = this.buffers[i]; // typed array backing store
                const vb = vao.VBs[i]; // appropriate vertex buffer
                vb.sync(gl, backing);
                this.dirtyCounters[i] -= 1;
            }
        }
    }
    // Makes appropriate draw call
    draw(gl,mode) {
        super.draw(gl,mode,this.ring.top());
    }
    toString() {
        return this.sch.toString();
    }
}

