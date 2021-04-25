import {nearestPowerOfTwoGreaterThanOrEqual,
        nearestPowerOfTwoLessThanOrEqual} from './util.js';
import {Spritesheet} from './spritesheet.js';
/*
# Image interface documentation:

All image classes support writer and reader interfaces. You can use the
"has"- prefixed attributes to check which pointers will be available.
I recommend using these flags to check how each object can be used, because
not every object supporting a specific interface will be related to the others
through something that JS knows about, like inheritance.

## Destruction
Like all objects corresponding to GPU resources, everything in this module
has a `destroy` method. You are advised to call it only when the GPU is done
using it to render with. Because the GPU is asyncronous, you should wait one
full frame cycle after the resouce is no longer used before deleting it. 
Otherwise, the destruction call may block the whole thread. If you think 
your GPU might be rendering more than one frame at a time, wait more than one.

## Readable Pixels
Anything that can have pixels read from it, but not written to it,
will have the following three attributes set:

- hasTexture = true
- texture = a WebGLTexture
- width = width in pixels
- height = height in pixels
- maxU = the highest useful u coordinate (used when the image data only covers part of the texture, 1.0 if the whole texture is real data.)
- maxV = the highest useful v coordinate (used when the image data only covers part of the texture, 1.0 if the whole texture is real data.)
- hasFramebuffer = true | false (see below)

## Writeable Pixels
Every pixel-writable image, i.e. every handle object that can be 
attached as an interface, has the following three attributes set:

-   hasFramebuffer = true
-   width = width in pixels
-   height = height in pixels
-   hasDepthstencil = true | false
-   framebuffer = a WebGLFramebuffer
-   hasTexture = true | false (see above)

## The Canvas's Renderbuffer

The canvas can be selected as a framebuffer by binding `null`. It can't be
read from by binding as a texture. 

*/

// Resize an image.
export function resizeImage(width,height,image,stretch=true) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d',{alpha:true,desynchronized:true});
    ctx.imageSmoothingEnabled = true;
    if (!stretch)
        ctx.clearRect(0,0,width,height); // transparent black
    if (stretch)
        ctx.drawImage(image,0,0,width,height);
    else
        ctx.drawImage(image,0,0); // This will not scale it
    return tempCanvas;
}

// Determines the source dimensions of anything that can be used to
// create a texture. Returns [width,height].
export function trueDimensions(source) {
    const w = source.naturalWidth || // HTMLImageElement
              source.videoWidth   || // HTMLVideoElement
              source.width;          // ImageData,HTMLCanvasElement,ImageBitmap
    const h = source.naturalHeight || // HTMLImageElement
              source.videoHeight   || // HTMLVideoElement
              source.height;          // ImageData,HTMLCanvasElement,ImageBitmap
    return [w,h];
}

/*
# Texture

## Settings
Settings `minFilter`,`magFilter`,`wrapS`, and `wrapT` correspond to
the typical OpenGL texture parameters. The `stretch` setting determines
the behavior that is invoked when something is wrong with the size of the
input texture. If `stretch` is true, the image will be scaled. If it is
false, it will be given transparent black padding if it is too small.

If the source image is larger than `gl.getParameter(gl.MAX_TEXTURE_SIZE)`,
it will always be scaled down, not clipped.

The need to resize the image is automatically determined from the filter and
wrapping settings. If the filter and wrapping settings could work with a
non-power-of-two texture, then the texture will not be resized unless it is
larger than the MAX_TEXTURE_SIZE gl parameter.

## Sources

Textures may be created with any of:
- ImageData,
- HTMLImageElement,
- HTMLCanvasElement,
- HTMLVideoElement,
- ImageBitmap.

Creation from buffers is not presently supported.
*/
export class Texture {
    constructor(gl,source,settings={},sheet=null) {
        // Interface info
        this.hasTexture = true;
        this.hasFramebuffer = false;
        // Read settings
        this.minFilter = gl[settings.minFilter  || 'LINEAR_MIPMAP_LINEAR'];
        this.magFilter = gl[settings.magFilter  || 'LINEAR'];
        this.wrapS =     gl[settings.wrapS      || 'CLAMP_TO_EDGE'];
        this.wrapT =     gl[settings.wrapT      || 'CLAMP_TO_EDGE'];
        this.stretch =   typeof settings.stretch === 'undefined' ?
                            true : settings.stretch;  
        // Figure out what we have, and what we need
        const mipmapsNeeded = !(this.minFilter === gl.NEAREST || 
                                this.minFilter === gl.LINEAR);
        const canBeNPoT = 
            !mipmapsNeeded &&
            this.wrapS === gl.CLAMP_TO_EDGE &&
            this.wrapT === gl.CLAMP_TO_EDGE;
        const [sourceWidth,sourceHeight] = trueDimensions(source);
        this.sourceWidth = sourceWidth;
        this.sourceHeight = sourceHeight;
        let safeSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        // safeSize is not always a power of two, so we have to clip it.
        safeSize = canBeNPoT ? safeSize : 
                               nearestPowerOfTwoLessThanOrEqual(safeSize);
        // Compute target width and height
        let targetWidth=sourceWidth,targetHeight=sourceHeight;
        // Grow to nearest power of two, if necessary
        if (!canBeNPoT) {
            targetWidth = nearestPowerOfTwoGreaterThanOrEqual(targetWidth);
            targetHeight = nearestPowerOfTwoGreaterThanOrEqual(targetHeight);
        }
        // Clip to safe size limits. This preserves the PoT property because
        // earlier we truncated safeSize to make sure it was PoT.
        if (targetWidth > safeSize) targetWidth = safeSize;
        if (targetHeight > safeSize) targetHeight = safeSize;
        // Safety shrinking overrides stretch setting, because we never clip.
        this.stretch = this.stretch || 
                      (targetWidth < sourceWidth) ||
                      (targetHeight < sourceHeight);
        // Resize the source image if necessary
        if (targetWidth !== sourceWidth || targetHeight !== sourceHeight) {
            source = resizeImage(targetWidth,targetHeight,source,this.stretch);
        }
        //console.log(this.stretch,sourceWidth,sourceHeight,'->',targetWidth,targetHeight);
        // Now, create the texture.
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0, // start at mip 0
            gl.RGBA, // Always use RGBA
            gl.RGBA, //must be the same as internalformat above
            gl.UNSIGNED_BYTE, // the only guaranteed supported type
            source, // upload the scaled source
        );
        // Set parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
        // Generate mipmaps if required for filtering
        if (mipmapsNeeded)
            gl.generateMipmap(gl.TEXTURE_2D)
        // Save useful parameters for reading from this texture later on
        this.width = targetWidth;
        this.height = targetHeight;
        // Compute the u and v coordinates that the data-filled region
        // extends over. If stretched, it's the whole thing.
        this.maxU = this.stretch ? 1.0 : sourceWidth / targetWidth;
        this.maxV = this.stretch ? 1.0 : sourceHeight / targetHeight;
        // Set up spritesheet
        this.sheet = new Spritesheet(this,sheet);
    }
    destroy(gl) {
        gl.deleteTexture(this.texture);    
    }
}

// Special case to make the builtin canvas renderbuffer fit the Writable Pixels
// interface (with hasFramebuffer = true, and so on.)
export class CanvasRenderbuffer {
    constructor(gl) {
        this.hasFramebuffer = true;
        this.hasTexture = false;
        this.framebuffer = null;
        this.hasDepthstencil = null;
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
        this.maxU = 1.0; // u coordinate ranges up to 1
        this.maxV = 1.0; // v coordinate ranges up to 1
        this.hasDepthstencil = hasDepthstencil;
        this.hasTexture = true;
        this.hasFramebuffer = true;
        // Create color attachment (image texture)
        //gl.activeTexture(gl.TEXTURE0); //It doesn't matter which texture unit
        this.texture = gl.createTexture();
        // Generate depth/stencil attachment if requested
        this.dsRenderbuffer = null; 
        if (this.hasDepthstencil) {
            // create render buffer
            this.dsRenderbuffer = gl.createRenderbuffer();
        }
        this.allocate(gl);
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
    // Sets up framebuffer
    allocate(gl) {
        // TEXTURE
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0, // framebuffers work on mip level 0
            gl.RGBA, //Only RGBA framebuffer support is guaranteed
            this.width,this.height,
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
        // RENDERBUFFER (depth/stencil)
        if (this.hasDepthstencil) {
            gl.bindRenderbuffer(gl.RENDERBUFFER,this.dsRenderbuffer);
            gl.renderbufferStorage(
                gl.RENDERBUFFER,
                gl.DEPTH_STENCIL,
                this.width,
                this.height,
            );
        }
    }
    resize(gl,width,height) {
        if (this.width === width && this.height === height) {
            return; // No need to do anything.
        }
        this.width = width;
        this.height = height;
        this.allocate(gl);
    }
    destroy(gl) {
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.texture);
        if (this.dsRenderbuffer !== null) {
            gl.deleteRenderbuffer(this.dsRenderbuffer);
        }
    }
}
