'use strict'

import {GL_TYPES_test} from '../webgltypes.js';
import {Shader, compileShaders} from '../shader.js';
import {Vec1,Vec2,Vec3,Vec4,
        Vec1I,Vec2I,Vec3I,Vec4I,
        Mat2,Mat3,Mat4} from '../vector.js';

// Attempts to create a webgl context with some common extensions.
// Returns {gl:null,messages:[...]} if creation failed (messages will explain why),
//  or {gl:webgl context,messages[...]} if succesful. (messages may contain warnings.)
// All of the `ext.*` extension attributes (functions and constants) are attached
//  directly to the returned `gl` object.
function getContext(canvas) {
    const messages = [];
    // Acquire context
    const context_settings = {
        alpha: false,
        desynchronized: true,
        antialias: false, // AA will be handled by shaders
        depth: false,
        failIfMajorPerformanceCaveat: true,
        // premultipliedAlpha: true, // Irrelevant, because alpha:false
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        stencil: false, // If there's no depth buffer there's no stencil.
    };
    let gl = canvas.getContext("webgl",context_settings);
    if (gl === null) {
        // retry context creation
        context_settings.failIfMajorPerformanceCaveat = false;
        gl = canvas.getContext("webgl",context_settings);
        if (gl === null) {
            messages.push("Could not acquire webgl context.");
            console.error(messages[messages.length-1]);
            return {gl:null,messages:messages};
        } else {
            messages.push("Warning: Browser reports major performance caveat.");
            console.warn(messages[messages.length-1]);
        }
    }
    // Acquire all extensions in "Feature Level 101,"[0] except for
    // WEBGL_debug_renderer_info which is not reliable due to 
    // browser fingerprinting protection.
    // [0] https://jdashg.github.io/misc/webgl/webgl-feature-levels.html
    const extensions = [
        'ANGLE_instanced_arrays',
        'EXT_blend_minmax',
        'OES_element_index_uint',
        'OES_standard_derivatives',
        'OES_vertex_array_object',
        'WEBGL_lose_context',
    ];
    let missing_extension = false;
    for (const name of extensions) {
        const extension = gl.getExtension(name);
        if (extension === null) {
            messages.push(`Missing required extension ${name}.`);
            console.error(messages[messages.length-1]);
            missing_extension = true;
        }
        else {
            for (const attrname in extension) {
                // Attach extension object.
                gl[attrname] = extension[attrname];
                //console.log(`${name} adds ${attrname}`);
            }
        }
    }
    return {gl:gl,messages:messages};
}

// Test shader compiler
const {gl,messages} = getContext(document.querySelector("canvas"));
if (gl !== null) {
    GL_TYPES_test(gl);
    const shaders = compileShaders(
        gl,
        {v:document.querySelector('#shader-v').textContent},
        {f:document.querySelector('#shader-f').textContent},
        {shader:['v','f']},
    );
    const shader = shaders.shader;
    console.log(shader.toString());
    // Create simple square VBO to cover viewport
    const square_verts = new Float32Array([
        -1.0,-1.0,
        1.0,-1.0,
        -1.0,1.0,
        1.0,1.0,
    ]);    
    const square_vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, square_vbo);
    gl.bufferData(gl.ARRAY_BUFFER, square_verts, gl.STATIC_DRAW);
    
    // Enable shader
    gl.useProgram(shader.handle);
    const vertex_loc = gl.getAttribLocation(shader.handle,'vertex');
    gl.enableVertexAttribArray(vertex_loc);
    gl.vertexAttribPointer(vertex_loc, 2, gl.FLOAT, false, 0, 0);
    
    // Create vec
    const time = Vec1.From(0.0);
    (function tick(t_ms) {
        if (t_ms !== null) {
            time.eqFrom(t_ms * 0.001);
            // Oscillate blue channel
            // Prepare target
            gl.useProgram(shader.handle);
            shader.uniform(shader.uniforms.time, time.a);
            shader.sync(gl);
            
            // Arrays
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        }
        window.requestAnimationFrame(tick);
    })(null);
}




























