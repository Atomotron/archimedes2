import {isDefined,printTree} from './util.js';
import {compileShaders} from './shader.js';
import {Texture} from './image.js';
import {IO} from './io.js';

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

function asyncXMLHttpRequest(url,type) {
    return new Promise( (resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET',url,true);
        request.responseType = type;
        request.onload = () => resolve(request.response);
        request.error = () => reject(request.statusText);
        request.send();
    })
}

async function getTextAtUrl(url) {
    return await asyncXMLHttpRequest(url,'text');
}

// Will return either an ImageBitmap or an HTMLImageElement
async function getImageAtUrl(url) {
    const response = await asyncXMLHttpRequest(url,'blob');
    if (isDefined(createImageBitmap)) { // Non-safari-users get the good route
        return createImageBitmap(response);
    } else { // Safari users get the hack
        function imageFromBlob(blob) {
            const img = new Image();
            const dataUrl = URL.createObjectURL(blob);
            const promise = new Promise(
                resolve => {
                    img.onload = () => {
                        URL.revokeObjectURL(dataUrl);
                        resolve(img);
                    }
                }
            );
            img.src = dataUrl;
            return promise;
        }
        return await imageFromBlob(response);
    }
}


// Will return an array buffer
async function getArrayBufferAtUrl(url) {
    return await asyncXMLHttpRequest(url,'arraybuffer');
}

// Returns a promise that resolves to a string
async function loadStringResource(resource) {
    if (typeof resource === 'string') {
        return resource;
    } else if (resource instanceof HTMLElement) {
        // Get the inner text
        return resource.textContent;
    } else if (resource instanceof URL) {
        return await getTextAtUrl(resource);
    } else {
        throw "Attempted to load unrecognized type.";
    }
}

// Returns a promise that resolves to an image resource
async function loadImageResource(resource) {
    if (resource instanceof HTMLImageElement) {
        return resource;
    } else if (resource instanceof URL) {
        return await getImageAtUrl(resource);
    } else {
        throw "Attempted to load unrecognized type.";
    }
}

// Returns a promise that resolves to a sound
async function loadSoundResource(resource) {
    if (resource instanceof URL) {
        return await getArrayBufferAtUrl(resource);
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
    constructor(gl,io,shaders,images,sounds) {
        this.gl = gl;
        this.io = io;
        this.shaders = shaders;
        this.images = images;
        this.sounds = sounds;
    }
}

const defaultProgressCallbacks = {
    vertex : (loaded,total) => console.log(`Loaded ${loaded}/${total} vertex shader sources.`),
    fragment : (loaded,total) => console.log(`Loaded ${loaded}/${total} fragment shader sources.`),
    image : (loaded,total) => console.log(`Loaded ${loaded}/${total} images.`),
    sound : (loaded,total) => console.log(`Loaded ${loaded}/${total} sounds.`),
    waitingForInteraction : () => {console.log("The loader cannot finish until a user interaction unsticks the audio context. Waiting...")},
}


export async function load(settings,progressCallbacks={}) {
    progressCallbacks = Object.assign(progressCallbacks,defaultProgressCallbacks);
    // Set up audio context and listener
    const aud = new AudioContext({
        latencyHint: "interactive",
    });
    const unstickEvents = [
        'mousemove','mousedown','mouseup',
        'keydown','keyup',
    ];
    let alreadyUnstuck = false;
    function asyncEvent(type) {
        return new Promise( (resolve, reject) => {
            window.addEventListener(
                type,
                (e) => {
                    aud.resume().then( a => {
                        resolve(a);
                    });
                },
                {once:true},
            );
        });
    }
    // Set up several promises to unsticking 
    const unstickingPromises = [];
    for (const type of unstickEvents) {
        unstickingPromises.push(asyncEvent(type));
    }
    const unstuck = Promise.any(unstickingPromises).then(
        ctx => {
            alreadyUnstuck = true;
        }
    );
    
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
        errors.set("settings",'missing attribute "canvas"');
    }
    // Loading stage 1: Network requests
    const errors = new Map();
    const promises = new Map();
    const results = new Map();

    // Shaders
    // Get source strings
    if (isDefined(settings.shaders)) {
        for (const type of ['vertex','fragment']) {
            if (isDefined(settings.shaders[type])) {
                promises.set(type+'-sources',loadResources(
                    settings.shaders[type],
                    loadStringResource,
                    progressCallbacks[type],
                ));
            } else {
                errors.set("settings.shaders",`missing attribute "${type}"`);
            }
        }
        if (isDefined(settings.shaders.programs)) {
            // Convert to map
            const programs = new Map();
            for (const name in settings.shaders.programs) {
                programs.set(name,settings.shaders.programs[name]);
            }
            results.set('program-pairs',programs);
        } else {
            errors.set('settings.shaders',`missing attribute "program-pairs"`);
        }
    } else {
        errors.set("settings",`missing attribute "shaders"`);
    }
    
    // Images
    if (isDefined(settings.images)) {
        promises.set('images',loadResources(
            settings.images,
            loadImageResource,
            progressCallbacks.image,
        ));
    } else {
        errors.set("settings",`missing attribute "images"`);
    }
    
    // Sounds
    if (isDefined(settings.sounds)) {
        promises.set('sounds',loadResources(
                settings.sounds,
                async (res) => 
                    aud.decodeAudioData(await loadSoundResource(res)),
                progressCallbacks.image,
            ),
        )
    } else {
        errors.set("settings",`missing attribute "sounds"`);
    }
    

    // Sort promises into errors and results
    for (const [name,promise] of promises) {
        try {
            results.set(name,await promise);
        } catch (e) {
            errors.set(name,e);
        }
    }
    
    // Loading stage 2: Resource processing.
    // Shaders
    let shaders = null;
    if (gl !== null 
        && results.has('vertex-sources') 
        && results.has('fragment-sources')
        && results.has('program-pairs')
    ) {
        shaders = compileShaders(
            gl,
            results.get('vertex-sources'),
            results.get('fragment-sources'),
            results.get('program-pairs'),
        );
    } else { 
        errors.set('compile-shaders','earlier failures prevent shader compilation');
    }
    
    // Images -> Texture objects
    let images = {};
    if (gl !== null && results.has('images')) {
        for (const [name,image] of results.get('images')) {
            let imageSettings = {};
            if (settings.imageSettings && settings.imageSettings[name]) {
                imageSettings = settings.imageSettings[name];
            }
            images[name] = new Texture(gl,image,imageSettings);
        }
    }
    
    // Sound array buffers -> AudioBuffer
    let sounds = {};
    if (results.has('sounds')) {
        for (const [name,data] of results.get('sounds')) {
            sounds[name] = data;
        }
    }
    
    // Wait until audio context is unstuck before returning.
    if (!alreadyUnstuck) {
        progressCallbacks.waitingForInteraction();
    }
    await unstuck;
    
    // If there are any errors, format them into a tree and return the message.
    if (errors.size > 0) {
        throw printTree(errors);
    }
    // Construct IO object
    const io = new IO(settings.canvas,aud);
    
    return new Resources(
        gl,
        io,
        shaders,
        images,
        sounds,
    );
}
