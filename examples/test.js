'use strict'

import {
    load,
    CanvasRenderbuffer,Framebuffer,Texture,
    compileShaders, compileRenderer,
    
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from '../archimedes.js';

// Test shader compiler
load({canvas:document.querySelector("canvas")}).then( (res) => {
    const gl = res.gl;
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
});




























