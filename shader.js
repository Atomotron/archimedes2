import {GL_TYPE_INDIRECT_ARRAYS} from './vector.js';
import {GL_TYPES} from './webgltypes.js';
/*
Depends on:
- `vector.js`
- `webgltypes.js`
*/


// Shading program
export class Shader {
    // OpenGL type enum -> string mapping
    // gl[TYPES[x]] == x, for all x in:
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#data_types
    constructor(gl,handle,name) {
        this.destroyed = false; // Has this shader been free'd?
        this.name = name;       // Name for debugging purposes
        this.handle = handle;   // OpenGL program handle
        // Uncover shader inputs (uniforms and attributes)
        const nattribs = gl.getProgramParameter(this.handle,gl.ACTIVE_ATTRIBUTES);
        const nuniforms = gl.getProgramParameter(this.handle,gl.ACTIVE_UNIFORMS);
        for (let i=0; i<nattribs; ++i) {
            const info = gl.getActiveAttrib(this.handle,i);
            const type = GL_TYPES[info.type];
        }
        for (let i=0; i<nuniforms; ++i) {
            const info = gl.getActiveUniform(this.handle,i);
            const type = GL_TYPES[info.type];
            console.log(i,info.name,type.nelements);
        }   
    }
    // Tell OpenGL to forget about this program.
    destroy(gl) {
        if (this.destroyed) {
            throw `Can't destroy shader ${this.name}; it is already destroyed.`;
        }
        gl.deleteProgram(this.handle);
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
            console.error(gl.getShaderInfoLog(p));
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
