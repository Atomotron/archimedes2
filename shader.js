import {GL_TYPE_INDIRECT_ARRAYS} from './vector.js';
import {GL_TYPES} from './webgltypes.js';
/*
Depends on:
- `vector.js`
- `webgltypes.js`
*/

// For some reason, Javascript doesn't have this...
// NOTE: ASSUMES COMPATIBLE TYPES AND LENGTHS
function arrayEquals(a,b,b_offset=0) {
    for (let i=0; i<a.length; ++i) {
        if (a[i] !== b[i+b_offset]) return false;
    }
    return true;
}

// Stores the attribute type information necessary to determine whether a vertex
// array object is compatible with a shader.
class AttributeSchema {
    // Constructs a schema from an array of WebGLActiveInfo
    constructor(infos) {
        this.indices = new Map();
        this.names = [];
        this.type_codes = [];
        for (const info of infos) {
            this.indices.set(info.name,this.names.length);
            this.names.push(info.name);
            this.type_codes.push(info.type);
            // OpenGL ES GLSL 1.0 section 4.3.3:
            // "Attribute variables cannot be declared as arrays or structures."
            console.assert(info.size === 1,"Attributes are never array types.");
        }
    }
    toString() {
        const lines = ['Attr.\tName\tGLType\tType Name'];
        for (const [name,i] of this.indices) {
            const typecode = this.type_codes[i];
            const typename = GL_TYPES[typecode].name;
            lines.push(`${i}\t${name}\t${typecode}\t${typename}`);
        }
        return lines.join('\n');
    }
}

// A shader pipeline program
// Contains uniforms because in the OpenGL specification,
// shader program objects remember the uniforms you set on them
// between invocations. That makes the shader object the natural
// location for that state information.
export class Shader {
    // Minimum maximums taken from:
    // https://jdashg.github.io/misc/webgl/webgl-feature-levels.html
    constructor(gl,handle,name) {
        this.destroyed = false; // Has this shader been free'd?
        this.name = name;       // Name for debugging purposes
        this.handle = handle;   // OpenGL program handle
        /***** Attributes *****/
        const nattribs = gl.getProgramParameter(this.handle,gl.ACTIVE_ATTRIBUTES);
        const attrinfos = [];
        for (let i=0; i<nattribs; ++i) {
            attrinfos.push(gl.getActiveAttrib(this.handle,i));
        }
        this.attributeSchema = new AttributeSchema(attrinfos);
        console.log(`${this.attributeSchema}`);
        
        /***** Uniforms *****/
        const nuniforms = gl.getProgramParameter(this.handle,gl.ACTIVE_UNIFORMS);
        this.uniforms = {}; // name -> uniform id
        this.uniformNames = []; // uniform id -> name
        this.uniformTypes = []; // Only used for debugging, but useful nonetheless.
        this.bufferIds = []; // uniform id -> buffer id
        this.bufferOffsets = []; // uniform id -> element offset in storage
        this.buffers = []; // uniform storage buffers
        this.uniformLocations = [];
        this.dirtyFlags = []; // true|false, keep track of which buffers need to be uploaded
        this.uniformv = []; // Pointers to gl uniformNv methods to call when uploading
        const addUniform = (name,type,bufferid,offset) => {
            const i = this.bufferIds.length; // convenient uniform counter
            this.uniforms[name] = i;
            this.uniformNames.push(name);
            this.uniformTypes.push(type);
            this.bufferIds.push(bufferid);
            this.bufferOffsets.push(offset);
        };
        for (let i=0; i<nuniforms; ++i) {
            const info = gl.getActiveUniform(this.handle,i);
            const type = GL_TYPES[info.type];
            const current_buffer = this.buffers.length; // index of the buffer
            this.buffers.push(
                    // A buffer big enough for the whole array if size > 1,
                    // or just the one thing, if size === 1.
                    new type.TypedArray(type.nelements*info.size)
            );
            this.dirtyFlags.push(false);
            this.uniformv.push(type.uniformv);
            this.uniformLocations.push(gl.getUniformLocation(this.handle,info.name));
            if (info.name.endsWith('[0]')) { // Array uniform
                const basename = info.name.slice(0,-3); // remove [0]
                // Iterate over every element of the uniform array
                for (let array_index=0; array_index<info.size; ++array_index) {
                    const name = `${basename}[${array_index}]`;
                    addUniform(name,info.type,current_buffer,
                        array_index*type.nelements);
                }
            } else { // Non-array uniforms
                console.assert(info.size === 1,"Non-array uniform variables should have a size of 1, shouldn't they?");
                addUniform(info.name,info.type,current_buffer,0);
            }
        }
    }
    // Tell OpenGL to forget about this program.
    destroy(gl) {
        if (this.destroyed) {
            throw `Can't destroy shader ${this.name}; it is already destroyed.`;
        }
        gl.deleteProgram(this.handle);
    }
    // Returns true iff the given typed array is appropriate for uploading
    // to the given uniform id
    typecheck(id,typedArray) {
        return typedArray instanceof GL_TYPES[this.uniformTypes[id]].TypedArray &&
            typedArray.length === GL_TYPES[this.uniformTypes[id]].nelements;
    }
    // Copies the given data to the given uniform ID,
    // updating the dirty flag if appropriate.
    uniform(id,typedArray) {
        const bufferId = this.bufferIds[id];
        const buffer=this.buffers[bufferId],
              offset=this.bufferOffsets[id],
              dirty =this.dirtyFlags[bufferId];
        // Update dirty flag iff it needs to be updated
        if (!dirty) {
            if (arrayEquals(typedArray,buffer,offset)) {
                return; // Don't bother copying
            } else {
                this.dirtyFlags[bufferId] = true; // Flag as dirty
            }
        }
        // Copy array data
        buffer.set(typedArray,offset);
    }
    // Syncronizes stored uniform data with the GPU, according to
    // which dirty flags are set.
    sync(gl) {
        for (let i=0; i<this.buffers.length; ++i) {
            if (this.dirtyFlags[i]) {
                gl[this.uniformv[i]](this.uniformLocations[i],this.buffers[i]);
                this.dirtyFlags[i] = false; // We uploaded it, so it's no longer dirty.
            }
        }
    }
    // Debugging pretty-print
    toString() { 
        const lines = [`SHADER ${this.name}`];
        if (this.bufferIds.length > 0) {
            lines.push("Uniform\tBuffer\tOffset\tType Name\tName");
            for (let i=0; i<this.bufferIds.length; ++i) {
                lines.push(
                    `${i}\t` +
                    `${this.bufferIds[i]}\t` +
                    `${this.bufferOffsets[i]}\t` + 
                    `${GL_TYPES[this.uniformTypes[i]].name}\t` +
                    `${this.uniformNames[i]}\t`
                );
            }
        } else {
            lines.push("(no uniforms)");
        }
        lines.push(this.attributeSchema.toString());
        return lines.join('\n');
    } 
}
// Returns an object full of `Shader`s, built from compiling the given sources.
// Arguments:
//  gl            : webgl context
//  vshaderSources: object mapping vertex shader names to GLSL sources
//  fshaderSources: object mapping fragment shader names to GLSL sources
//  programPairs  : object mapping shader program names to pairs like,
//                      ['fshader_name','vshader_name']
// Example invocation:
//  const shaders = compileShaders(
//      gl,
//      {vertshader:document.querySelector('#shader-v').textContent},
//      {fragshader:document.querySelector('#shader-f').textContent},
//      {myshader:['vertshader','fragshader']},
//  );
//  // shaders ==> {myshader: [object Shader]}
export function compileShaders(gl,vshaderSources,fshaderSources,programPairs) {
    let errors = 0;
    // Verify that sources are actually strings
    function checkTypes(sources,type) {
        for (const name in sources) {
                if (typeof sources[name] !== 'string') {
                    errors += 1;
                    console.error(`The source code of ${type} shader "${name}" isn't a string; it's`,sources[name]);
                    delete sources[name];
                }
            }
    }
    checkTypes(vshaderSources,'vertex');
    checkTypes(fshaderSources,'fragment');
    // Log program mismatches
    for (const name in programPairs) {
        const [vname,fname] = programPairs[name];
        const [has_v,has_f] = [vname in vshaderSources,fname in fshaderSources];
        if (!has_v || !has_f) {
            errors += 1;
            delete programPairs[name]; // Don't bother compiling it.
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
        for (const name in sources) {
            const s = gl.createShader(type);
            gl.shaderSource(s,sources[name]);
            gl.compileShader(s);
            shaders.set(name,s);
        }
        return shaders;
    }
    const vshaders = compileStageShaders(vshaderSources,gl.VERTEX_SHADER);
    const fshaders = compileStageShaders(fshaderSources,gl.FRAGMENT_SHADER);
    // Link shaders into programs.
    const programs = new Map();
    for (const name in programPairs) {
        const [vname,fname] = programPairs[name]; // unpack program pair
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
                    sources[name],
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
    const triggering_index = lines[line].search(triggering);
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
