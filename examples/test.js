'use strict'

import {
    load,
    CanvasRenderbuffer,Framebuffer,
    compileRenderer,
    Geometry,
    // Passes
    SUM,DrawPass,ClearPass,
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from '../archimedes.js';

// Test shader compiler
load({
    canvas:document.querySelector("canvas"),
    shaders: {
        vertex: {
            bv:document.querySelector('#background-v'),
            sv: new URL("smile.vert", document.baseURI),
        },
        fragment:{
            bf:document.querySelector('#background-f'),
            sf:document.querySelector('#sprite-f'),
        },
        programs: {background:['bv','bf'],sprite:['sv','sf']},
    },
    images: {
        tools: document.getElementById('tex'),
        smile: new URL("smile.png", document.baseURI),
    },
    imageSettings: {
    
    },
    sounds: {
        loop: new URL("loop.ogg", document.baseURI),
        hit: new URL("hit.ogg", document.baseURI),
    },
    streams: {
        mozilla: new URL("loop.ogg", document.baseURI),
    },
    skipAudioWait: true,
}).then( (res) => {
    window.res = res;
    const gl = res.gl;
    const shaders = res.shaders;
    const bgShader = shaders.background;
    console.log(shaders.background.toString());
    // Media stream
    const streamNode = res.io.adc.createMediaElementSource(res.streams.mozilla);
    streamNode.connect(res.io.mixer);
    window.mozilla = res.streams.mozilla;
    
    // Framebuffer
    const fb = new Framebuffer(gl,128,128);
    // Texture
    const tex = res.images['tools'];
    
    // VBS test
    const bgGeom = new Geometry(gl,bgShader.schema({vertex:{divisor:0,stream:false}}),4);
    bgGeom.vert.acquire().vertex.eqFrom(-1.0,-1.0);
    bgGeom.vert.acquire().vertex.eqFrom( 1.0,-1.0);
    bgGeom.vert.acquire().vertex.eqFrom(-1.0, 1.0,);
    bgGeom.vert.acquire().vertex.eqFrom( 1.0, 1.0,);
    bgGeom.sync(gl); // It's static, so we only need to call it once.
    
    // Sprites
    const spriteGeom = new Geometry(
        gl,
        shaders.sprite.schema({
            vertex      :{divisor:0,stream:false},
            translate   :{divisor:1,stream:true},
            transform   :{divisor:1,stream:true},
            color       :{divisor:1,stream:true},
        }),
        4,
        1024*4
    );
    spriteGeom.vert.acquire().vertex.eqFrom(-1.0,-1.0);
    spriteGeom.vert.acquire().vertex.eqFrom( 1.0,-1.0);
    spriteGeom.vert.acquire().vertex.eqFrom(-1.0, 1.0,);
    spriteGeom.vert.acquire().vertex.eqFrom( 1.0, 1.0,);
    
    // centers
    const centers = [Vec2.From(0.5,0.5),Vec2.From(-0.5,0.5),Vec2.From(0,-0.5)];
    // times
    const time = Vec1.From(0.0);
    const times = [Vec1.From(2.0),Vec1.From(1.0),Vec1.From(0.0)];
    let nextIndex = 0;
    
    // Framebuffer
    const frame = new Framebuffer(gl,512,512);
    res.io.onResize.add( io => frame.resize(gl,io.width,io.height) );
    const canvasFb = new CanvasRenderbuffer(gl);
    // Render environment
    const camera = Mat2.Id();
    const cameraInv = Mat2.Id();
    const CameraPass = SUM(DrawPass,{uniforms:{aspect:camera,aspectInv:cameraInv}});
    const sequence = [
        SUM(ClearPass,{framebuffer: frame}),
        SUM(CameraPass,{
            name: "Sprites",
            framebuffer: frame,
            shader:shaders.sprite,
            draw: (gl) => {
                spriteGeom.draw(gl,gl.TRIANGLE_STRIP);
            },
            uniforms: {t:time},
            samplers: {spritesheet: res.images.smile},
        }),
        ClearPass,
        SUM(CameraPass,{
            name:"Swirl",
            shader:bgShader,
            uniforms: {
                t: time,
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
        }),
    ];
    window.gl = gl;
    const [render,env] = compileRenderer(sequence);
    
    // Audio
    const node = res.io.adc.createBufferSource();
    const gain = res.io.adc.createGain();
    gain.gain.value = 0.25;
    gain.connect(res.io.mixer);
    node.buffer = res.sounds.loop;
    node.loop = true;
    node.connect(gain);
    node.start();
    
    canvas.addEventListener('mousedown',(e) => {
        times[nextIndex].eqFrom(0);
        centers[nextIndex].eq(res.io.cursor);
        console.log(centers[nextIndex].toString());
        centers[nextIndex].transformEq(cameraInv);
        console.log(cameraInv.toString());
        console.log(centers[nextIndex].toString());
        nextIndex = (nextIndex + 1) % centers.length;
        
        const node = res.io.adc.createBufferSource();
        node.buffer = res.sounds.hit;
        node.connect(res.io.mixer);
        node.start();
    });
    
    let last_t = null;
    const offset = Vec2.From(-1.0,-1.0);
    (function tick(t_ms) {
        res.io.refresh();
        // Update camera from time
        camera.eqId();
        camera.mulEq(1.0 + 1.13*Math.tan(time.x*0.1));
        camera.composeEq(res.io.aspect);
        camera.rotateEq(time.x * 0.1);
        cameraInv.eqInverse(camera);
        
        if (t_ms !== null && last_t !== null) {
            const dt = (t_ms - last_t) * 0.001;
            // Add new sprites
            const s = spriteGeom.inst.acquire();
            s.translate.eqFrom(Math.random(),Math.random())
                .mulEq(2)
                .addEq(offset);
            s.transform.eqFrom(Math.random()-0.5+1,Math.random()-0.5,
                               Math.random()-0.5,Math.random()-0.5+1).mulEq(0.1);
            s.color.eqFrom(Math.random(),Math.random(),
                           Math.random(),Math.random());
            // Upload data and render            
            times[0].x += dt;         
            times[1].x += dt;         
            times[2].x += dt;
            time.x += dt;
            spriteGeom.sync(gl);            
            render(gl,env);            
        }
        if (t_ms !== null) {
            last_t = t_ms;
        }
        window.requestAnimationFrame(tick);
    })(null);
});




























