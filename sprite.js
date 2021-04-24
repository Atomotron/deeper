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
const ANIM_FRAME_FOLDER_REGEX = /^.*\//;

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
        this.res = res;
        
        // Load animations
        const animations = new Map();
        for (name in this.texture.sheet.frame) {
            const result = name.match(NUMBER_POSTFIX_REGEX);
            if (result.length === 0) continue;
            const postfix = result[result.length-1];
            const index = parseInt(postfix.slice(0, - ('.png'.length)),10);
            let action = 'move';
            if (name.slice(0, -postfix.length).endsWith('rotate')) {
                action = 'rotate';
            }
            const folder = name.match(ANIM_FRAME_FOLDER_REGEX)[0].slice(0,-1);
            console.log(folder,action,index,name);
            const actions = animations.get(folder) || new Map();
            const frames = actions.get(action) || new Map();
            frames.set(index,name);
            actions.set(action,frames);
            animations.set(folder,actions);
        }
        // Convert to packed format
        this.animations = {};
        for (const [folder,actions] of animations) {
            for (const [action,frameMap] of actions) {
                const indices = Array.from(frameMap.keys());
                indices.sort();
                const names = [];
                for (const index of indices) {
                    names.push(frameMap.get(index));
                }
                // Map names to spritesheets
                const frames = {frame:[],model:[],control:[]};
                for (const name of names) {
                    frames.frame.push(this.texture.sheet.frame[name]);
                    frames.model.push(this.texture.sheet.model[name]);
                    frames.control.push(this.texture.sheet.control[name]);
                }
                // Write to animation object
                if (!this.animations[folder]) this.animations[folder] = {};
                this.animations[folder][action] = frames;
            }
        }
    }
}

// One particular sprite
export class Sprite {
    ANIM_MPF = 24
    IDLE_VELOCITY = 10
    constructor(sprites,engine,folder='croc',action='move') {
        this.sprites = sprites;
        this.engine = engine;
        this.folder = folder;
        this.action = action;
        this.frameIndex = 0;
        this.frameDirection = 1;
        this.frameDistanceTraveled = 0;
        this.pos = Vec2.From(0.0,0.0);
        this.posDelta = Vec2.From(0.0,0.0);
        this.destroyed = false;
        // Set up animation frames
        this.update(0);
        // Acquire an instance
        this.struct = sprites.inst.acquire();
        // Register for synchronization
        this.engine.register(this);
        this.sync();
    }
    destroy() {
        if (this.destroyed) return;
        this.sprites.inst.relenquish(this.struct);
        this.engine.unregister(this);
        this.destroyed = true;
    }
    // Advance
    step(dt,t) {
        this.frameDistanceTraveled += dt*this.IDLE_VELOCITY;
    }
    // Update
    update(t) {
        this.frames = this.sprites.animations[this.folder][this.action];
        const nframes = this.frames.frame.length;
        if (this.frameDistanceTraveled > this.ANIM_MPF) {
            this.frameIndex += this.frameDirection;
            if (this.frameIndex === nframes-1 || this.frameIndex === 0) {
                this.frameDirection = -this.frameDirection;
            }
            this.frameDistanceTraveled = 0;
        }
        // Safety
        this.frameIndex = this.frameIndex % nframes;
    }
    // Synchronize 
    sync() {
        const com = this.frames.control[this.frameIndex].CoM.pos;
        //console.log(com+'');
        this.struct.pos.eq(this.pos);
        this.struct.pos.subEq(com);
        this.struct.model.eq(this.frames.model[this.frameIndex]);
        this.struct.frame.eq(this.frames.frame[this.frameIndex]);
    }
    // Move, keeping track for animation.
    moveTo(newPos) {
        this.posDelta.eqSub(this.pos,newPos);
        const distance = this.posDelta.mag();
        this.frameDistanceTraveled += distance;
        this.pos.eq(newPos);
    }
}
