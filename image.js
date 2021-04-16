/*
# Image interface documentation:

All image classes support writer and reader interfaces. You can use the
"has"- prefixed attributes to check which pointers will be available.
I recommend using these flags to check how each object can be used, because
not every object supporting a specific interface will be related to the others
through something that JS knows about, like inheritance.

## Readable Pixels
Anything that can have pixels read from it, but not written to it,
will have the following three attributes set:

- hasTexture = true
- texture = a WebGLTexture
- hasFramebuffer = true | false (see below)

## Writeable Pixels
Every pixel-writable image, i.e. every handle object that can be 
attached as an interface, has the following three attributes set:

-   hasFramebuffer = true
-   hasDepthstencil = true | false
-   framebuffer = a WebGLFramebuffer
-   hasTexture = true | false (see above)

## The Canvas's Renderbuffer

The canvas can be selected as a framebuffer by binding `null`. It can't be
read from by binding as a texture. 

*/

class Texture {
    constructor() {
    
    }
}

// Special case to make the builtin canvas renderbuffer fit the Writable Pixels
// interface (with hasFramebuffer = true, and so on.)
export class CanvasRenderbuffer {
    constructor(gl) {
        this.hasFramebuffer = true;
        this.framebuffer = null; // This signifies the canvas RB
        // Get info about the default framebuffer
        // note: It's not possible to do this with the normal
        // "getFramebufferAttachmentParameter" query, because
        // "querying against the default framebuffer is not allowed
        // in webgl 1." (- firefox error message)
        const info = gl.getContextAttributes();
        // TODO: Change the renderbuffer system so that stuff
        //       will not mysteriously stop working if a context
        //       is created with depth but no stencil or stencil
        //       with no depth.
        this.hasDepthstencil = info.depth && info.stencil;
    }
}

/*
From the webgl spec:
The following combinations of framebuffer object attachments, when all of the attachments are framebuffer attachment complete, non-zero, and have the same width and height, must result in the framebuffer being framebuffer complete:

    COLOR_ATTACHMENT0 = RGBA/UNSIGNED_BYTE texture
    COLOR_ATTACHMENT0 = RGBA/UNSIGNED_BYTE texture + DEPTH_ATTACHMENT = DEPTH_COMPONENT16 renderbuffer
    COLOR_ATTACHMENT0 = RGBA/UNSIGNED_BYTE texture + DEPTH_STENCIL_ATTACHMENT = DEPTH_STENCIL renderbuffer 
*/

// A framebuffer. Contains an image (no need to be POT) configured to be
// rendered to, and optionally a depth-stencil renderbuffer attachment.
export class Framebuffer {
    // Makes a framebuffer. Arguments:
    //    size            : [width,height]
    //    has_depthstencil: whether or not want a DEPTH_STENCIL_ATTACHMENT
    constructor(gl,width,height,hasDepthstencil=false) {
        this.width = width;
        this.height = height;
        this.hasDepthstencil = hasDepthstencil;
        // Create color attachment (image texture)
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
            this.texture,
            0, // framebuffers work on mip level 0
            gl.RGBA, //Only RGBA framebuffer support is guaranteed
            width,height,
            0, // border, must be 0
            gl.RGBA, //must be the same as internalformat above
            gl.UNSIGNED_BYTE, // the only guaranteed supported type
            null, // don't upload any pixels
        );
        // Disable all the stuff that doesn't work with non-power-of-two textures
        // (mipmapping is unsuppored for framebuffers anyway because they always
        //  draw to mip level 0, so the only remaining true loss is gl.REPEAT.)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // Generate depth/stencil attachment if requested
        this.dsRenderbuffer = null; 
        if (this.hasDepthstencil) {
            // create render buffer
            this.dsRenderbuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER,this.dsRenderbuffer);
            gl.renderbufferStorage(
                gl.RENDERBUFFER,
                gl.DEPTH_STENCIL,
                width,
                height,
            );
        }      
        // Create framebuffer
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.texture,
            0, // mipmap level must be 0
        );
        if (this.hasDepthstencil) { // Attach depth/stencil if necessary
            gl.framebufferRenderbuffer(
                gl.FRAMEBUFFER,
                gl.DEPTH_STENCIL_ATTACHMENT,
                gl.RENDERBUFFER,
                this.dsRenderbuffer,
            );
        }
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error(`Framebuffer creation failed with code ${status}.`);
        }
    }
    destroy(gl) {
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.texture);
        if (this.dsRenderbuffer !== null) {
            gl.deleteRenderbuffer(this.dsRenderbuffer);
        }
    }
}


// A render target, which can be a sequence of framebuffers stretching back
// into the past. This is useful for feedback loops where f_{t} depends on
// f_{t-1}, the value of the buffer at an earlier point in time.
// It also permits resizing of the underlying framebuffer, and delayed
// garbage collection.
class Target {
    constructor() {
    
    }
}
