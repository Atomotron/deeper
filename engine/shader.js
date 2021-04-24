import {GL_TYPE_INDIRECT_ARRAYS} from './linearalgebra.js';
import {GL_TYPES} from './webgltypes.js';
import {tabulate,isDefined} from './util.js';
import {VertexArraySchema} from './vertices.js';

// djb2 (dan bernstein)
// http://www.cse.yorku.ca/~oz/hash.html
function hash(string) {
    let hash = new Uint32Array(1); // seed
    for (let i=0; i<string.length; ++i) {
        const c = string.charCodeAt(i);
        // Faster in JS than the bitshift trick,
        // according to unscientific profiling
        hash[0] = hash[0]*33 + c;
    }
    return hash[0];
}

// Assign samplers to image units based on sampler name string hash
function assignImageUnits(samplers,max_units) {
    if (samplers.length > max_units) 
        throw "Attempting to assign more textures than image units.";
    const units = new Map(); // number -> name
    for (const sampler of samplers) {
        let x = hash(sampler);
        // Increment x until we find an unused slot.
        while (units.has(x % max_units)) 
            x += 1;
        // Now that x is unused, save it.
        units.set(x % max_units,sampler);
    }
    // Reverse map direction
    const assignments = new Map();
    for (const [unit,sampler] of units) {
        assignments.set(sampler,unit);
    }
    return assignments;
}

// Stores the attribute type information necessary to determine whether a vertex
// array object is compatible with a shader.
export class AttributeSchema {
    // Types: name -> opengl type code
    // Locations: name -> attribute location
    constructor(types,locations) {
        this.names = new Set(types.keys());
        this.types = types;
        this.locations = locations;
    }
    // Returns a sub-schema where only the given names are included.
    subschema(names) {
        const t = new Map();
        const l = new Map();
        for (const name of names) {
            t.set(name,this.types.get(name));
            l.set(name,this.locations.get(name));
        }
        return new AttributeSchema(t,l);
    }
    toString() {
        const rows = [["NAME","ATTRIBUTE TYPE","LOCATION"]];
        for (const [name,type] of this.types) {
            rows.push([name,GL_TYPES[type].name,this.locations.get(name)]);
        }
        return tabulate("Attributes",rows);
    }
}

// A shader pipeline program
// Contains uniforms because in the OpenGL specification,
// shader program objects remember the uniforms you set on them
// between invocations. That makes the shader object the natural
// location for that state information.
/*
## Shader

A non-normative note in the WebGL 1.0 spec says:
"Performance problems have been observed on some implementations when using uniform1i to update sampler uniforms. To change the texture referenced by a sampler uniform, binding a new texture to the texture unit referenced by the uniform should be preferred over using uniform1i to update the uniform itself."

Consequently, the samplers are fixed to automatically chosen texture image
units at load time.

### Attributes
- `program`: `WebGLProgram` handle to linked shader program.
- `uniforms`: Object mapping name -> `WebGLUniformLocation`
- `samplers`: Object mapping name -> texture image unit assignment
- `attributes`: Object mapping name -> attribute location (GLint)
- `attributeSchema`: Attribute type info
- `uniformSchema`: Uniform type info
*/
export class Shader {
    // Minimum maximums taken from:
    // https://jdashg.github.io/misc/webgl/webgl-feature-levels.html
    constructor(gl,program,name) {
        this.destroyed = false; // Has this shader been free'd?
        this.name = name;       // Name for debugging purposes
        this.program = program; // OpenGL program handle
        /***** Attributes *****/
        const nattribs = gl.getProgramParameter(this.program,gl.ACTIVE_ATTRIBUTES);
        const attrTypes = new Map();
        const attrLocs = new Map(); // name -> attrib location (GLint)
        for (let i=0; i<nattribs; ++i) {
            const info = gl.getActiveAttrib(this.program,i);
            attrTypes.set(info.name,info.type);
            attrLocs.set(info.name,gl.getAttribLocation(this.program,info.name));
        }
        this.attributeSchema = new AttributeSchema(attrTypes,attrLocs);
        
        /***** Uniforms *****/
        const nuniforms = gl.getProgramParameter(this.program,gl.ACTIVE_UNIFORMS);
        this.uniformTypes = new Map();
        this.uniforms = {}; // name -> webgl uniform handle (WebGLUniformLocation)
        const samplerUniforms = new Map(); // name -> sampler uniform handle
        for (let i=0; i<nuniforms; ++i) {
            const info = gl.getActiveUniform(this.program,i);
            const isSampler = GL_TYPES[info.type].is_sampler;
            // Deconstruct arrays into separate locations
            if (info.name.endsWith('[0]')) {
                const basename = info.name.slice(0,-3); // remove [0]
                for (let i=0; i<info.size; ++i) {
                    // For every index in the array...
                    const element_name = `${basename}[${i}]`;
                    const element_type = info.type;
                    const element_handle =              
                        gl.getUniformLocation(this.program,element_name);
                    this.uniformTypes.set(element_name,element_type);
                    if (isSampler)
                        samplerUniforms.set(element_name,element_handle);
                    else
                        this.uniforms[element_name] = element_handle;
                }
            } else {
                // It's not an array uniform, so there's no need to deconstruct it.
                console.assert(
                    info.size===1,
                    "I think uniform names not ending in `[0]` must have a size of 1."
                );
                this.uniformTypes.set(info.name,info.type);
                const uniform_handle =              
                    gl.getUniformLocation(this.program,info.name);
                if (isSampler)
                    samplerUniforms.set(info.name,uniform_handle);
                else
                    this.uniforms[info.name] = uniform_handle;
            }
        }
        /***** Samplers *****/
        const nImageUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        // name -> fixed image unit number
        this.samplers = assignImageUnits(
            Array.from(samplerUniforms.keys()),
            nImageUnits
        );
        // Set uniform values, which will be remembered for the shader's life.
        gl.useProgram(this.program);
        for (const [name,unit] of this.samplers) {
            gl.uniform1i(samplerUniforms.get(name),unit);
        }
    }
    // Tell OpenGL to forget about this program.
    destroy(gl) {
        if (this.destroyed) {
            throw `Can't destroy shader ${this.name}; it is already destroyed.`;
        }
        gl.deleteProgram(this.handle);
    }
    // Returns true iff the given uniform should be uploaded to this shader
    hasUniform(name) {
        return this.uniformTypes.has(name);
    }
    // Returns the GL type code of the given uniform
    type(name) {
        return this.uniformTypes.get(name);
    }
    // Debugging pretty-print
    toString() { 
        const lines = [`Shader \`${this.name}\``];
        lines.push(this.attributeSchema.toString());
        // Uniform table
        const utable = [['NAME','UNIFORM TYPE']];
        for (const name in this.uniforms) {
            const type = this.uniformTypes.get(name);
            utable.push([name,GL_TYPES[type].name]);
        }
        lines.push(tabulate("Uniforms",utable));
        // Sampler table
        const stable = [["NAME","IMAGE UNIT"]];
        for (const [name,unit] of this.samplers) {
            stable.push([name,unit]);
        }
        lines.push(tabulate("Samplers",stable));
        return lines.join('\n\n');
    } 
    // Convienience constructor for Geometry class
    schema(configuration={}) {
        const divisors=new Map(), stream=new Map();
        for (const name of this.attributeSchema.names) {
            if (isDefined(configuration[name])) {
                const info = configuration[name];
                divisors.set(name,isDefined(info.divisor) ? info.divisor : 1);
                stream.set(name,isDefined(info.stream)    ? info.stream : true);
            } else {
                divisors.set(name,1); // Default: instance variable
                stream.set(name,true); // Better to send too often than too rarely 
            }
        }
        return new VertexArraySchema(
            this.attributeSchema,
            divisors,stream,
        );
    }
}
// Returns an object full of `Shader`s, built from compiling the given sources.
// Arguments:
//  gl            : webgl context
//  vshaderSources: Map mapping vertex shader names to GLSL sources
//  fshaderSources: Map mapping fragment shader names to GLSL sources
//  programPairs  : Map mapping shader program names to pairs like,
//                      ['fshader_name','vshader_name']
export function compileShaders(gl,vshaderSources,fshaderSources,programPairs) {
    let errors = 0;
    // Verify that sources are actually strings
    function checkTypes(sources,type) {
        for (const [name,source] of sources) {
                if (typeof source !== 'string') {
                    errors += 1;
                    console.error(`The source code of ${type} shader "${name}" isn't a string; it's`,source);
                    sources.delete(name);
                }
            }
    }
    // Log program mismatches
    for (const [name,[vname,fname]] of programPairs) {
        const [has_v,has_f] = [vshaderSources.has(vname),fshaderSources.has(fname)];
        if (!has_v || !has_f) {
            errors += 1;
            programPairs.delete(name); // Don't bother compiling it.
        }
        if (!has_v) {
            console.error(`Program "${name}" requires missing vertex shader "${vname}".`);
        }
        if (!has_f) {
            console.error(`Program "${name}" requires missing fragment shader "${fname}".`);
        }
    }
    // Compile vertex and fragment shaders
    function compileStageShaders(sources,type) {
        const shaders = new Map();
        for (const [name,source] of sources) {
            const s = gl.createShader(type);
            gl.shaderSource(s,source);
            gl.compileShader(s);
            shaders.set(name,s);
        }
        return shaders;
    }
    const vshaders = compileStageShaders(vshaderSources,gl.VERTEX_SHADER);
    const fshaders = compileStageShaders(fshaderSources,gl.FRAGMENT_SHADER);
    // Link shaders into programs.
    const programs = new Map();
    for (const [name,[vname,fname]] of programPairs) {
        if (!vshaders.has(vname) || !fshaders.has(fname)) {
            continue;
        }
        const p = gl.createProgram();
        gl.attachShader(p,vshaders.get(vname));
        gl.attachShader(p,fshaders.get(fname));
        gl.linkProgram(p);
        programs.set(name,p);        
    }
    // Check the programs for errors.
    for (const [name,p] of programs) {
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.error(`Error linking shader program "${name}":`);
            console.error(gl.getProgramInfoLog(p));
            gl.deleteProgram(p); // Discard failed program
            programs.delete(name); // Drop our reference to it.
        }
    }
    // Check the shaders for errors. 
    // (Done after checking programs, because shader errors are usually
    //  more interesting, and we want them to show up at the base of the
    //  error console for easier viewing.)
    function checkStageShaders(shaders,sources,type) {
        for (const [name,s] of shaders) {
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error(prettyPrintShaderErrors(
                    `${type} shader "${name}"`,
                    sources.get(name),
                    gl.getShaderInfoLog(s),
                ));
                errors += 1;
            }
        }
    }
    checkStageShaders(vshaders,vshaderSources,'vertex');
    checkStageShaders(fshaders,fshaderSources,'fragment');
    // Delete the gl shaders; they are no longer needed after linking.
    for (const type of [vshaders,fshaders]) {
        for (const [name,s] of type) {
            gl.deleteShader(s);
        }
    }
    // Wrap gl program handles in our engine's shader objects.
    // Since GL "shaders" are never used again outside of this function, 
    // we will rename GL "programs" to "shaders" in the nomenclature of 
    // this engine. This is the point where the nomenclature shifts.
    const shaders = {};
    for (const [name,p] of programs) {
        shaders[name] = new Shader(gl,p,name);
    }
    // Wrap up compilation and return results.
    if (errors > 0) {
        console.error(`Finished shader compilation with ${errors} error(s) and ${programs.size} complete shader program(s).`);
    }
    return shaders;
}

// WebGL shader compilation errors don't provide a lot of context.
// This pretty-printer extracts line numbers from the message, and
// formats a helpful report on the site of the issue.
// My driver can return several errors on several lines, so first let's split them.
function prettyPrintShaderErrors(name,source,message) {
    const errors = message.split(/\r?\n/);
    const readouts = [];
    for (const error of errors) {
        if (error.length == 0) continue;
        readouts.push(prettyPrintShaderError(name,source,error));
    }
    return readouts.join("\n");
}

// Pretty-print a single error.
function prettyPrintShaderError(name,source,error) {
    const lowEffortMessage = `When compiling ${name}: ${error}`;
    const lines = source.split(/\r?\n/);
    // An OpenGL compilation error will look like:
    //  "ERROR: 0:11: 'daytime' : syntax error"
    // So, the first thing we do is split at the :
    const errorParts = error.split(":"); 
    if (errorParts[0] !== "ERROR" || errorParts.length < 3) { 
        // Give up if it doesn't look like we're expecting.
        return lowEffortMessage;
    }
    const [part,line] = [
        parseInt(errorParts[1],10),
        parseInt(errorParts[2],10) - 1 // OpenGL starts at line 1
    ];
    if (part !== 0) return lowEffortMessage; // 'part' is an OpenGL thing that webGL shouldn't have. If it isn't zero, then we aren't properly parsing the error.
    if (line >= lines.length) return lowEffortMessage;
    // Attempt to find the error-triggering string in the bad line
    // Strip whitespace and wrapping quotes
    const triggering = errorParts[3].replace(/^\s+['|"]|['|"]\s+$/g, '');
    console.log(lines,line,triggering);
    const triggering_index = lines[line].indexOf(triggering);
    // Probe for missing semicolons, a common error.
    // This regex-based heuristic is NOT PERFECT, but it can work sometimes.
    let semicolon_missing_at = null;
    // Semicolons, { and } can all go before a statement.
    const goodLine = /[;|{|}]\s*(\/\/.*)?$/; 
    const emptyLine = /^\s*(\/\/.*)?$/;
    for (let i=line-1; i>=0; --i) {
        if (goodLine.test(lines[i])) break; // We found line that terminates right.
        if (!emptyLine.test(lines[i])) { // If the line has stuff on it...
            semicolon_missing_at = i; // then since we haven't found a good one...
            break; // it must be a bad one. We're done!
        }
    }
    // Decide whether or not we suspect a missing semicolon/brace
    let suspected_missing_semicolon = false;
    if (semicolon_missing_at !== null && triggering_index >= 0) {
        // If the triggering string appears after nothing but whitespace
        if (/\s*/.test(lines[line].slice(0,triggering_index))) {
            suspected_missing_semicolon = true;
        }
    }
    // Select context for error from source lines
    const context_end = line+1; // Our context must include the triggering line!
    const context_start = context_end - 3; // 3 lines of context by default
    if (semicolon_missing_at !== null && context_start > semicolon_missing_at) {
        context_start = semicolon_missing_at; // Always include the suspected line
    }
    if (context_start <= 0) context_start = 0;
    const context = lines.slice(context_start,context_end);
    // Assemble the message
    if (suspected_missing_semicolon) {
        const loc_in_context = semicolon_missing_at - context_start;
        context[loc_in_context] += " ◀◀◀ MISSING SOMETHING?";
    }
    const message = [`When compiling ${name}:\n`].concat(context);
    if (triggering_index >= 0) {
        message.push(' '.repeat(triggering_index) + '▀'.repeat(triggering.length));
    }
    message.push(error);
    let longest = 0;
    for (const l of message) if (l.length > longest) longest = l.length;
    message.unshift('='.repeat(longest+1));
    return message.join('\n');
}
