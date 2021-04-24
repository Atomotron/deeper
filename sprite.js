import {
    // Drawing stuff
    Geometry,
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

import {Quad} from './quad.js';

const NUMBER_POSTFIX_REGEX = /\d+\.png$/;

// A layer of sprites, all of the same type.
export class Sprites extends Quad {
    constructor(res,
        shadername="sprite",
        texturename="sprites",
        instances=1,
        configuration={}
        ) {
        // Default configuration
        Object.assign(configuration, {
            vertex:{divisor:0,stream:false},
            pos   :{divisor:1,stream:true},
            model :{divisor:1,stream:true},
            frame :{divisor:1,stream:true},
        });
        const texture = res.images[texturename];
        const shader = res.shaders[shadername];
        const schema = shader.schema(configuration);
        super(res.gl,schema,instances);
        this.texture = texture;
        this.shader = shader;
        
        // Just for the croc
        this.animations = {};
        
        const animations = new Map();
        for (name in this.texture.sheet.frame) {
            const result = name.match(NUMBER_POSTFIX_REGEX);
            if (result.length === 0) continue;
            const postfix = result[result.length-1];
            const index = parseInt(postfix.slice(0, - ('.png'.length)),10);
            let animation = 'move';
            if (name.slice(0, -postfix.length).endsWith('rotate')) {
                animation = 'rotate';
            }
            console.log(name,index,animation);
        } 
    }
}

// One particular sprite
export class Sprite {
    ANIM_FPS = 12
    constructor(sprites,engine) {
        this.sprites = sprites;
        this.engine = engine;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.destroyed = false;
        // Acquire an instance
        this.struct = sprites.acquire();
        // Register for synchronization
        this.engine.register(this);
        this.sync();
    }
    destroy() {
        if (this.destroyed) return;
        this.sprites.relenquish(this.struct);
        this.engine.unregister(this);
        this.destroyed = true;
    }
    // Advance
    step(dt,t) {
        this.frameTimer += dt;
    }
    // Update
    update(t) {
        if (this.frameTimer > 1/this.ANIM_FPS) {
            this.frameIndex = (this.frameIndex+1) % this.sprites.frames.length;
            this.frameTimer = 0;
        }
    }
    // Synchronize 
    sync() {
        const frame = this.sprites.frames[this.frameIndex];
        this.struct.model.eq(frame.model);
        this.struct.frame.eq(frame.frame);
    }
}
