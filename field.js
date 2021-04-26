import {
    // Setup
    compileRenderer,
    // Drawing stuff
    Framebuffer,Geometry,
    // Passes
    SUM,DrawPass,ClearPass,
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';
import {Sprites,Sprite} from './sprite.js';

function circularModuluo(x,m) {
    let mod = x % m;
    if (mod < 0) mod = m + mod;
    //console.log(x,m,mod);
    return mod;
}

function wrap(x,low,high) {
    const shiftedX = x - low;
    const shiftedHigh = high - low;
    const shiftedMod = circularModuluo(shiftedX,shiftedHigh)
    return low + shiftedMod;
}

export class Brushes extends Sprites {
    constructor(res,
        shadername="sprite",
        texturename="brushes",
        instances=1,
        configuration={},
        wrapX,
        ) {
        super(res,shadername,texturename,instances,configuration);
        this.wrapX = wrapX;
    }
}

export class Brush extends Sprite {
    constructor(sprites,engine,spritename,pos=Vec2.Zero(),facing=1,angle=0,scale=1) {
        super(sprites,engine,spritename,pos,facing,angle,scale);
        this.struct2 = sprites.inst.acquire();
    }
    destroy() {
        super.destroy();
        this.sprites.inst.relenquish(this.struct2);
    }
    sync() {
        super.sync();
        this.struct2.model.eq(this.struct.model);
        this.struct2.frame.eq(this.struct.frame);
        this.struct2.color.eq(this.struct.color);
        // Wrap pos
        this.struct.pos.x = (
            wrap(this.struct.pos.x, -this.sprites.wrapX, this.sprites.wrapX)
        );      
        // Wrap pos2
        this.struct2.pos.eq(this.struct.pos);
        if (this.struct.pos.x > 0) {
            this.struct2.pos.x -= 2*this.sprites.wrapX;
        } else {
            this.struct2.pos.x += 2*this.sprites.wrapX;
        }
    }
}

export class Splat extends Brush {
    constructor(sprites,engine,spritename,pos=Vec2.Zero(),
        facing=Math.floor(Math.random()*2)*2-1, // -1 or 1
        angle=Math.random()*Math.PI*2,
        scale=Settings.SPLAT_SCALE) {
        super(sprites,engine,spritename,pos,facing,angle,scale);
        this.seen = false;
    }
    update(t) {
        super.update(t);
        if (this.seen) {
            this.destroy();
        } else {
            this.seen = true;
        }
    }
}

export class Field {
    constructor(res,baseTexture,bgModelInv,bgPos) {
        this.res = res;
        this.fb = new Framebuffer(
            res.gl,
            baseTexture.width,
            baseTexture.height,
            false,
            baseTexture.source,
            true,
        );
        this.readPos = Vec2.Zero();
        this.buf = new Uint8Array(4 * 4);
        this.bgModelInv = bgModelInv;
        this.bgPos = bgPos;
        this.f = Vec4.Zero();
        this.dfdx = Vec4.Zero();
        this.dfdy = Vec4.Zero();
    }
    read(pos) {
        const gl = this.res.gl;
        // Compute source point in viewport coords
        this.readPos.eqSub(pos,this.bgPos);
        this.readPos.transformEq(this.bgModelInv);
        // Convert to uv coordinates
        this.readPos.mulEq(0.5);
        this.readPos.x += 0.5;
        this.readPos.y += 0.5;
        // Convert to texture coordinates
        let x = Math.floor(this.fb.width * this.readPos.x   );
        let y = Math.floor(this.fb.height* this.readPos.y   );
        // Cut Y
        if (y >= this.fb.height-1 || y < 0) {
            this.f.eqZero();
            this.dfdx.eqZero();
            this.dfdy.eqZero();
            return;
        }
        // Wrap X
        x = x % this.fb.width;
        if (x < 0) x = this.fb.width + x;
        // Trap loop reads
        if (x >= this.fb.width-1) {
            this.f.eqZero();
            this.dfdx.eqZero();
            this.dfdy.eqZero();
            return;
        }        
        // Read data at that location.
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb.framebuffer);
        gl.readPixels(x,y,2,2,gl.RGBA,gl.UNSIGNED_BYTE,this.buf);
        // Compute sample
        this.f.a.set(this.buf.subarray(0,4));
        this.dfdx.a.set(this.buf.subarray(4,8));
        this.dfdy.a.set(this.buf.subarray(8,12));
        this.dfdx.subEq(this.f);
        this.dfdy.subEq(this.f);
        //console.log(''+this.f+' df/dx: '+this.dfdx+' df/dy: '+this.dfdy);
    }
}
