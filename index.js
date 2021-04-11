'use strict'

import {GL_TYPES_test} from './webgltypes.js';
import {Shader, compileShaders} from './shader.js';

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
GL_TYPES_test(gl);
console.log(
    compileShaders(
        gl,
        {a:document.querySelector('#shader-v').textContent},
        {b:document.querySelector('#shader-f').textContent},
        {myshader:['a','b']},
    )
);
