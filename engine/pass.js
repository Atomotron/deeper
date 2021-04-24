import {GL_TYPES} from './webgltypes.js';
import {Shader} from './shader.js';
import {CanvasRenderbuffer} from './image.js';
/*
# Render Pass Sequence Compiler
*/

/*
### Environment format:
```javascript
{
      // Shader and uniform handles
      shaders: {shader name: {
        program: WebGLProgram,
        uniforms: {uniform1: WebGLUniformLocation, ...},
      }, ...},
      framebuffers: {framebuffer name: framebuffer (see Image.js)}
      textures: {texture name: texture (see Image.js)}
      // IndirectArrays for uploading to uniforms
      variables: {uniform1: {a: typed array}, ...},
      // Functions to call when a pass is ready
      callbacks: {callbackName: pass callback, ...}
}```

### Explicit pass format:
```javascript
{
      name: pass name
      framebuffer: framebuffer name
      callback: callback name
      samplers: Map<image unit # -> texture name>
      // Shader and uniform handles
      shader: shader name,
      uniforms: Map<uniform name -> variable name>,
      uniformTypes: Map<uniform name -> uniform type>,
}```
*/

const cfb = new CanvasRenderbuffer();
// Template passes
export const ClearPass = {   
    name:"Clear",
    framebuffer: cfb,
    shader: null,
    uniforms: {},
    draw: (gl) => {
        gl.clearColor(0.0,0.0,0.0,0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    },
    samplers: {},
};

export const DrawPass = {   
    name:"Draw",
    framebuffer: cfb,
    samplers: {},
    uniforms: {},
};

// From joliss' NPM module "js-string-escape" with slight modifications
// https://github.com/joliss/js-string-escape/blob/master/index.js
function jsString(string) {
    const escaped = ('' + string).replace(/["'\\\n\r\u2028\u2029]/g, character => {
    // Escape all characters not included in SingleStringCharacters and
    // DoubleStringCharacters on
    // http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
        switch (character) {
            case '"':
            case "'":
            case '\\':
                return '\\' + character
            // Four possible LineTerminator characters need to be escaped:
            case '\n':
                return '\\n'
            case '\r':
                return '\\r'
            case '\u2028':
                return '\\u2028'
            case '\u2029':
                return '\\u2029'
        }
    });
    return `"${escaped}"`;
};

// Returns true iff the given pass sequence can be depointerized.
function typecheckDepointerize(passes) {
    function shapeCheck(x,shape) {
        let good = true;
        for (const name in shape) {
            if (typeof x[name] === "undefined") {
                good = false;
                console.error(x,"missing",name);
                continue;
            } 
            if (shape[name].startsWith("?")) {
                if (x[name] === null ||
                    typeof x[name] === shape[name].slice(1)) continue;
            } else {
                if (typeof x[name] === shape[name]) continue;
            }
            console.error(x,`has wrong type on ${name}: should be`,shape[name]);
            good = false;
        }
        return good;
    }
    const SHAPE = {
        name:       "string",
        shader:     "?object",
        framebuffer:"?object",
        uniforms:   "?object",
        samplers:   "?object",
        draw:       "function",
    }
    let good = true;
    for (const pass of passes) {
        const good_shape = shapeCheck(pass,SHAPE);
        good &&= good_shape;
        if (!good_shape) continue;
        // Make sure that the framebuffer is actually a framebuffer
        if (!pass.framebuffer.hasFramebuffer) {
            good = false;
            console.error('Pass',pass.name,'framebuffer set to',
            'something that isn\'t a framebuffer:',pass.framebuffer);
        }
        
        // Make sure the shader is actually a shader
        if (!(pass.shader instanceof Shader)) {
            if (pass.shader !== null) {
                good = false;
                console.error('Pass',pass.name,'does not have a Shader set as its',
            'shader. Instead, it has:',pass.shader);
            }
            continue;
        }
        
        // Typecheck uniform/shader uniform correspondence
        for (const name in pass.shader.uniforms) {
            if (typeof pass.uniforms[name] === "undefined") {
                good = false;
                console.error('Pass',pass.name,'missing required uniform:',
                              name);
                continue;
            }
        }
        // Make sure all the textures are actually textures, and that
        // none of them are the framebuffer.
        for (const sampler in pass.samplers) {
            const texture = pass.samplers[sampler];
            if (texture === pass.framebuffer) {
                good = false;
                console.error("Pass",pass.name,"has its own render target",
                "assigned to sampler:",sampler);
                continue;
            }
            if (!texture.hasTexture) {
                good = false;
                console.error('Pass',pass.name,'sampler',sampler,'set to',
                'something that isn\'t a texture:',texture);
                continue;
            }
        }
        // Make sure that all of the samplers in the shader
        // are set by the pass. (Analouge of uniform check above.)
        for (const [sampler,unit] of pass.shader.samplers) {
            if (typeof pass.samplers[sampler] === "undefined") {
                good = false;
                console.error('Pass',pass.name,'missing required sampler:',
                              sampler);
                continue;
            }
        }
    }
    return good;
}

// Utility class for depointerization
class Deduplicator {
    constructor() {
        this.names = new Map();// names
        this.refs = new Map(); // ref -> name
    }
    // Attempts to add the reference to the internal map.
    // If the default name is already taken, choose a new one
    // by incrementing an appended number.
    // RETURNS THE NAME BY WHICH IT WAS ACTUALLY ADDED
    add(ref,defaultName='') {
        if (this.refs.has(ref)) {
            return this.refs.get(ref);
        }
        let name = defaultName || '0';
        for (let i=1; this.names.has(name); ++i) {
            // This will eventually count up to a name that's not used.
            name = `${defaultName}${i}`;
        }
        // at this point, `name` is unused
        this.names.set(name,ref);
        this.refs.set(ref,name);
        return name; // return the name we ended up using
    }
    asObject() {
        return Object.fromEntries(this.names);
    }
}

// Extracts pointers from the passes in a sequence 
// to produce an abstract sequence and an environment.
// RETURNS: [sequence,env]
function depointerize(passes) {
    const shaders   = new Deduplicator(),
          variables = new Deduplicator(),
          textures  = new Deduplicator(),
          framebuffers = new Deduplicator(),
          callbacks = new Deduplicator();
    // Special value that flags default canvas
    framebuffers.add(null,"CANVAS");
    const variableTypes = new Map();
    const depointerized = []; // Passes with pointers removed.
    for (const pass of passes) {
        // Make sure to catch canvas framebuffers, to name them "CANVAS"
        // This also ensures that separately constructed CanvasRenderbuffer
        // objects will get recognized as equal.
        let framebufferName = 'CANVAS';
        if (pass.framebuffer.framebuffer !== null) {
            framebufferName = framebuffers.add(pass.framebuffer,pass.name);
        }
        const callbackName = callbacks.add(pass.draw,pass.name);
        let shaderName=null,uniforms=null,samplers=null,uniformTypes=null;
        if (pass.shader !== null) {
            shaderName = shaders.add(pass.shader,pass.shader.name);
            // UNIFORMS
            uniforms = new Map();
            uniformTypes = new Map();
            for (const name in pass.uniforms) {
                // Just forget about unused uniforms.
                if (!pass.shader.hasUniform(name)) continue;
                // The shader has it, so let's use it.
                const vname = variables.add(pass.uniforms[name],name);
                uniforms.set(name,vname);
                uniformTypes.set(name,pass.shader.type(name));
            }
            // SAMPLERS
            samplers = new Map();
            for (const sampler in pass.samplers) {
                if (!pass.shader.samplers.has(sampler)) continue;
                const texture = pass.samplers[sampler];
                const textureName = textures.add(texture,sampler);
                const unit = pass.shader.samplers.get(sampler);
                samplers.set(unit,textureName);
            }
        }

        // Construct new pass
        depointerized.push({
            name: pass.name,
            callback: callbackName,
            framebuffer: framebufferName,
            shader: shaderName,
            samplers: samplers,
            uniforms: uniforms,
            uniformTypes: uniformTypes,
        });
    }
    // Build environment
    const env = {
        shaders:shaders.asObject(),
        variables:variables.asObject(),
        callbacks:callbacks.asObject(),
        framebuffers:framebuffers.asObject(),
        textures: textures.asObject(),
    };
    return [depointerized,env];
}

// Builds up a list of lines of code to satisfy each pass given to it.
// Since each pass has to be hit in the order they're given, the only
// optimization possible is not double-executing the same gl calls.
// So, we keep track of what the gl state is, and that's that.
class PassRecorder {
    constructor() {
        // in the following, `null` means "unset and not equal to anything"
        this.lines = [// Lines of code built up to execute function.
        // Variable to store current shader object
        "let shader = null;",
        // Variable to store current framebuffer
        "let framebuffer = null;",
        ]; 
        // State information
        this.framebuffer = null; // name of bound framebuffer
        this.shader = null; // name of shader in use
        this.uniforms = new Map(); // shader name -> 
                                   //    Map<uniform name -> variable name>
        this.settings = new Map(); // pipeline setting name -> synced constant
        this.textures = new Map(); // texture unit ID -> synced texture name
    }
    // Checks to see if the given pass is correct, given an environment.
    // Returns [true,[]] if it is correct, otherwise [false,["messages",...]].
    // NOTE: Unused uniforms are permitted, because during development it's
    //       common for the GPU to optimize out and un-expose uniform variables
    //       that aren't used at that exact run. 
    typecheck(pass,env) {
        const messages = [];
        const prefix = `In pass ${pass.name}: `;
        const log = message => messages.push(prefix + message);
        let good = true; // true until a problem is found
        // If the shader is don't-care, the uniforms won't be uploaded.
        // Hence, we gate uniform and shader checking under this if:
        if (pass.shader !== null) {
            if (!env.shaders[pass.shader]) {
                good = false;
                log(`Shader ${pass.shader} not in env.`);
            } else {
                const shader_uniforms = env.shaders[pass.shader].uniforms;
                // Make sure that every uniform in the shader has a setting,
                // and that the setting is a variable that exists in `env`.
                for (const uniform_name in shader_uniforms) {
                    const variable = pass.uniforms.get(uniform_name);
                    if (typeof variable === "undefined") {
                        good = false;
                        log(`Shader ${pass.shader} requires uniform `+
                            `${uniform_name} which is not set in the pass.`);
                    } else if (variable !== null) { // We care about the variable
                        const variable_backing = env.variables[variable];
                        if (typeof variable_backing === "undefined") {
                            // Variable missing from environment
                            good = false;
                            log(`Uniform ${uniform_name} points to ` + 
                                `variable ${variable}, but ${variable}` +
                                `is not in the environment.`);
                            continue;
                        }
                        // Check that we are backed by an indirect array
                        const buffer = variable_backing.a;
                        if (typeof buffer === "undefined") {
                            good = false;
                            log(`Variable at ${uniform_name}->${variable} `+
                                `missing ".a" property (is not IndirectArray)`);
                            continue;
                        }
                        // Check that we have a type assigned
                        const type = pass.uniformTypes.get(uniform_name);
                        if (typeof type === "undefined") {
                            good = false;
                            log(`Uniform ${uniform_name} missing type.`);
                            continue;
                        }
                        // Check that the backing array is of the right type
                        if (!buffer instanceof GL_TYPES[type].TypedArray) {
                            good = false;
                            log(`Uniform ${uniform_name} set to ` +
                            `a ${typeof buffer} which is not an instance ` + 
                            `of ${typeof GL_TYPES[type].TypedArray}`);
                            continue;
                        }
                        // Check that the backing array is of the right size
                        if (buffer.length !== GL_TYPES[type].nelements) {
                            good = false;
                            log(`Uniform ${uniform_name} set to an array ` +
                            `with ${buffer.length} elements, but it needs ` + 
                            `${GL_TYPES[type].nelements}.`);
                            continue;
                        }
                        // We have checked everything about the uniform!
                    }
                }
            }
        }
        // We already checked the samplers during depointerization
        
        // Check to see if the callback is defined.
        const callback = env.callbacks[pass.callback];
        if (typeof callback === "undefined" || 
            !(callback instanceof Function)) {
            good = false;
            log(`callback is \`${callback}\`, which is not a function.`);
        }
        // Check to see if the framebuffer is defined,
        // and if it is actually a framebuffer.
        const fb = env.framebuffers[pass.framebuffer];
        if (typeof fb === "undefined" || 
            (pass.framebuffer !== 'CANVAS' && !fb.hasFramebuffer) ||
            (pass.framebuffer === 'CANVAS' && fb !== null)
            ) {
            good = false;
            log(`framebuffer is \`${fb}\`, which is not a framebuffer.`);
        }
        return [good,messages];
    }
    // Records a fully explicit pass. Assume typecheck returned true.
    record(pass) {
        const l = this.lines;
        l.push(`// Rendering "${pass.name}"`);
        // Swap framebuffers if needed
        if (pass.framebuffer !== this.framebuffer) {
            this.framebuffer = pass.framebuffer;
            if (pass.framebuffer === "CANVAS") {
                l.push(`framebuffer = null;`);
                l.push(`gl.bindFramebuffer(gl.FRAMEBUFFER,null); // Default (canvas) framebuffer`);
                l.push(`gl.viewport(0.0,0.0,`+
                       `gl.drawingBufferWidth,gl.drawingBufferHeight);`);
                l.push(`gl.scissor(0.0,0.0,`+
                       `gl.drawingBufferWidth,gl.drawingBufferHeight);`);
            } else {
                l.push(`framebuffer = env.framebuffers[${
                        jsString(pass.framebuffer)}];`);
                l.push(`gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer.framebuffer);`);
                l.push(`gl.viewport(0.0,0.0,`+
                       `framebuffer.width,framebuffer.height);`);
                l.push(`gl.scissor(0.0,0.0,`+
                       `framebuffer.width,framebuffer.height);`);
            }   
        }
        
        // If the shader is marked as "don't care" then the uniforms
        // don't need to be set. Hence, shader and uniform setting
        // is gated behind this null check.
        if (pass.shader !== null) { 
            // Swap shaders if needed
            if (pass.shader !== this.shader) {
                this.shader = pass.shader;
                l.push(`shader = env.shaders[${jsString(pass.shader)}];`);
                l.push(`gl.useProgram(shader.program);`);
            }
            // Load uniforms
            const shaderUniforms = this.uniforms.get(this.shader) || new Map();
            this.uniforms.set(shaderUniforms);
            for (const [uniform,variable] of pass.uniforms) {
                if (variable === null) continue; // Marked as "don't care"
                if (shaderUniforms.get(uniform) !== variable) {
                    shaderUniforms.set(uniform,variable);
                    const type = pass.uniformTypes.get(uniform);
                    const uniformv = GL_TYPES[type].uniformv;
                    const transpose = GL_TYPES[type].nattributes > 1 ?
                        'false,' : '';
                    l.push(`gl.${uniformv}(` + 
                        `shader.uniforms[${jsString(uniform)}],` +
                        transpose + 
                        `env.variables[${jsString(variable)}].a);`
                    );
                }
            }
            // Swap textures
            for (const [unit,texture] of pass.samplers) {
                if (texture === null) continue; // Marked as "don't care"
                if (this.textures.get(unit) !== texture) {
                    this.textures.set(unit,texture);
                    l.push(`gl.activeTexture(gl.TEXTURE0 + ${unit});`);
                    l.push(`gl.bindTexture(gl.TEXTURE_2D,` +
                        `env.textures[${jsString(texture)}].texture);`
                    );
                        
                }
            }
        }
        // Call draw callback
        l.push(`env.callbacks[${jsString(pass.callback)}](gl);`);
    }
    // Converts recorded stages to javascript code
    codegen() {
        //console.log(this.lines.join('\n'));
        return new Function('gl','env',this.lines.join('\n'));
    }
}

// A render consists of several passes.
export function compileRenderer(sequence) {
    const dud = new Function('gl','env',''); // function that does nothing
    // Compile sequence
    if (!typecheckDepointerize(sequence)) {
        return [dud,{}];
    }
    const [depointerized,env] = depointerize(sequence);
    const rec = new PassRecorder();
    for (const pass of depointerized) {
        const [good,messages] = rec.typecheck(pass,env);
        if (good) {
            for (const m of messages) console.warn(m);
            rec.record(pass); // It's good, record it.
        } else {
            console.error(`Skipping pass ${pass.name} due to errors:`);
            for (const m of messages) console.error(m);
        }
    }
    return [rec.codegen(),env];
}
