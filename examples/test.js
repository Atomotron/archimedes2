'use strict'

import {GL_TYPES_test} from '../webgltypes.js';
import {CanvasRenderbuffer,Framebuffer,Texture} from '../image.js';
import {Shader, compileShaders} from '../shader.js';
import {compileRenderer} from '../pass.js';
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
            gl[name] = extension;
        }
    }
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

// Test shader compiler
const {gl,messages} = getContext(document.querySelector("canvas"));
if (gl !== null) {
    GL_TYPES_test(gl);
    const shaders = compileShaders(
        gl,
        {bv:document.querySelector('#background-v').textContent,
         sv:document.querySelector('#sprite-v').textContent},
        {bf:document.querySelector('#background-f').textContent,
         sf:document.querySelector('#sprite-f').textContent},
        {background:['bv','bf'],sprite:['sv','sf']},
    );
    const bgShader = shaders.background;
    console.log(shaders.background.toString());
    // Framebuffer
    const fb = new Framebuffer(gl,128,128);
    // Texture
    const tex = new Texture(
        gl,
        document.getElementById('tex'),
        {stretch:true}
    );
    
    // VBS test
    const bgGeom = bgShader.geometry(gl,{vertex:{divisor:0,stream:false}},4);
    bgGeom.vert.acquire().vertex.eqFrom(-1.0,-1.0);
    bgGeom.vert.acquire().vertex.eqFrom( 1.0,-1.0);
    bgGeom.vert.acquire().vertex.eqFrom(-1.0, 1.0,);
    bgGeom.vert.acquire().vertex.eqFrom( 1.0, 1.0,);
    bgGeom.sync(gl); // It's static, so we only need to call it once.
    
    // Sprites
    const spriteGeom = shaders.sprite.geometry(gl, {
        vertex      :{divisor:0,stream:false},
        translate   :{divisor:1,stream:true},
        transform   :{divisor:1,stream:true},
        color       :{divisor:1,stream:true},
    });
    spriteGeom.vert.acquire().vertex.eqFrom(-1.0,-1.0);
    spriteGeom.vert.acquire().vertex.eqFrom( 1.0,-1.0);
    spriteGeom.vert.acquire().vertex.eqFrom(-1.0, 1.0,);
    spriteGeom.vert.acquire().vertex.eqFrom( 1.0, 1.0,);
    
    // centers
    const centers = [Vec2.From(0.5,0.5),Vec2.From(-0.5,0.5),Vec2.From(0,-0.5)];
    // times
    const times = [Vec1.From(2.0),Vec1.From(1.0),Vec1.From(0.0)];
    let nextIndex = 0;
    
    canvas.addEventListener('mousedown',(e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const glX = 2.0*x/rect.width - 1.0; // Convert to gl coords
        const glY = 1.0 - 2.0*y/rect.height;
        times[nextIndex].eqFrom(0);
        centers[nextIndex].eqFrom(glX,glY);
        nextIndex = (nextIndex + 1) % centers.length;
    });
    
    // Framebuffer
    const frame = new Framebuffer(gl,512,512);
    const canvasFb = new CanvasRenderbuffer(gl);
    // Render environment
    const sequence = [
        {   name:"Clear",
            framebuffer: frame,
            shader: null,
            uniforms: {},
            draw: (gl) => {
                gl.clearColor(0.0,0.1,0.2,0.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
            },
            samplers: {},
        },
        {   name:"Sprites",
            framebuffer: frame,
            shader:shaders.sprite,
            uniforms: {},
            draw: (gl) => {
                spriteGeom.draw(gl,gl.TRIANGLE_STRIP);
            },
            samplers: {},
        },
        {   name:"Swirl",
            framebuffer: canvasFb,
            shader:bgShader,
            uniforms: {
                'time[0]': times[0],
                'time[1]': times[1],
                'time[2]': times[2],
                'center[0]': centers[0],
                'center[1]': centers[1],
                'center[2]': centers[2],
            },
            draw: (gl) => {
                bgGeom.draw(gl,gl.TRIANGLE_STRIP);
            },
            samplers: {background: frame},
        },
    ];
    window.gl = gl;
    const [render,env] = compileRenderer(sequence);
    
    let last_t = null;
    const offset = Vec2.From(-1.0,-1.0);
    (function tick(t_ms) {
        //https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
        // Lookup the size the browser is displaying the canvas in CSS pixels.
        const displayWidth  = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        // Check if the canvas is not the same size.
        const needResize = canvas.width  !== displayWidth ||
                         canvas.height !== displayHeight;

        if (needResize) {
        // Make the canvas the same size
            canvas.width  = displayWidth;
            canvas.height = displayHeight;
            frame.resize(gl,displayWidth,displayHeight);
        }
        if (t_ms !== null && last_t !== null) {
            const dt = (t_ms - last_t) * 0.001;
            // Add new sprites
            const s = spriteGeom.inst.acquire();
            s.translate.eqFrom(Math.random(),Math.random())
                .mulEq(2)
                .addEq(offset);
            s.transform.eqFrom(Math.random(),Math.random(),
                               Math.random(),Math.random()).mulEq(0.1);
            s.color.eqFrom(Math.random()*0.2+0.1,Math.random()*0.6+0.1,
                           Math.random()*1.0,Math.random());
            // Upload data and render            
            times[0].x += dt;         
            times[1].x += dt;         
            times[2].x += dt;
            spriteGeom.sync(gl);            
            render(gl,env);            
        }
        if (t_ms !== null) {
            last_t = t_ms;
        }
        window.requestAnimationFrame(tick);
    })(null);
}





























