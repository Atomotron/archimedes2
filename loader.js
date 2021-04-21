import {isDefined,printTree} from './util.js';
import {compileShaders} from './shader.js';

// Routines for loading resources and setting things up
// Attempts to create a webgl context with some common extensions.
// Returns {gl:null,messages:[...]} if creation failed (messages will explain why),
//  or {gl:webgl context,messages[...]} if succesful. (messages may contain warnings.)
// All of the `ext.*` extension attributes (functions and constants) are attached
//  directly to the returned `gl` object.
export function getContext(canvas) {
    const messages = [];
    // Acquire context
    const context_settings = {
        alpha: false,
        desynchronized: true,
        antialias: false,
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
            //console.error(messages[messages.length-1]);
            return {gl:null,messages:messages};
        } else {
            //messages.push("Warning: Browser reports major performance caveat.");
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
            //console.error(messages[messages.length-1]);
            missing_extension = true;
        }
        else {
            gl[name] = extension;
        }
    }
    if (missing_extension) return {gl:null,messages:messages};
    // Set up alpha blending
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.enable(gl.SCISSOR_TEST);
    return {gl:gl,messages:messages};
}

// Returns a promise that resolves to a string
async function loadStringResource(resource) {
    if (typeof resource === 'string') {
        return new resource;
    } else if (resource instanceof HTMLElement) {
        // Get the inner text
        return new resource.textContent;
    } else if (resource instanceof URL) {
        throw "Not implemented.";
    } else {
        throw "Attempted to load unrecognized type.";
    }
}

// Takes: an Object of resources, a function to load them, and a function
//        to call with (nLoaded,nTotal).
// Returns: A Promise that resolves to a map filled with loaded resources
async function loadResources(resources,loader,progressCallback) {
    const promises = new Map();
    for (const name in resources) {
        const resource = resources[name];
        nTotal += 1; // Count resource
        promises.set(name,loader(resource));        
    }
    const errors = new Map();
    const results = new Map();
    progressCallback(results.size,promises.size); // 0, total
    for (const [name,promise] of promises) {
        try {
            results.set(name,await promise);
            progressCallback(results.size,promises.size);
        } catch (e) {
            errors.set(name,e);
        }
    }
    // If we found any errors, we failed this step overall.
    if (errors.size > 0) throw errors;
    return results;
}

class Resources {
    constructor(gl) {
        this.gl = gl;
    }
}

const defaultCallbacks = {
    
}

export async function load(settings,callbacks={}) {
    const errors = new Map();
    const promises = new Map();
    
    // Canvas and context
    let gl = null;
    if (isDefined(settings.canvas)) {
        let messages = null;
        ({gl,messages} = getContext(settings.canvas));
        if (gl === null) { // Failed to get context
            errors.set("getContext",messages.join('\n'));
        } else {
            for (const m of messages) console.warn(m);
        }
    } else {
        errors.set("settings","missing attribute `canvas`");
    }
    // Shaders
    
    
    // If there are any errors, format them into a tree and return the message.
    if (errors.size > 0) {
        throw printTree(errors);
    }
    return new Resources(
        gl,
    );
}
