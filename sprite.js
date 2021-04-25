import {
    // Drawing stuff
    Geometry,
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

import {Quad} from './quad.js';
import {Collider} from './collider.js';

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
                const frames = {frame:[],model:[],control:[],collision:[]};
                for (const name of names) {
                    frames.frame.push(this.texture.sheet.frame[name]);
                    frames.model.push(this.texture.sheet.model[name]);
                    frames.control.push(this.texture.sheet.control[name]);
                    frames.collision.push(this.texture.sheet.collision[name]);
                }
                // Write to animation object
                if (!this.animations[folder]) this.animations[folder] = {};
                this.animations[folder][action] = frames;
            }
        }
    }
}

// One particular sprite
export class Sprite extends Collider{
    ANIM_MPF = 24
    IDLE_VELOCITY = 12
    constructor(sprites,engine,folder='granny',action='move',sends=false,receives=true) {
        super(sends,receives);
        this.sprites = sprites;
        this.engine = engine;
        this.folder = folder;
        this.action = action;
        this.destroyed = false;
        // GEOMETRY
        // High-level
        this.pos = Vec2.From(0.0,0.0);
        this.facing = -1;
        // Low-level - determined by high-level.
        this.translate = this.pos.clone();
        this.transform = Mat2.Id();
        
        // ANIMATION STATE
        this.posDelta = Vec2.From(0.0,0.0);
        this.nextAction = action;
        this.frameIndex = 0;
        this.trueFrameIndex = 0;
        this.frameDistanceTraveled = this.ANIM_MPF;
        this.frameDirection = 1;
        // Set up animation frames
        this.update(0,Math.random()*this.ANIM_MPF);
        // Acquire an instance
        this.struct = sprites.inst.acquire();
        this.struct.color.eqFrom(1.0,1.0,0.0,1.0);
        // Register for synchronization
        this.engine.register(this);
        this.sync();
        // Register for collision detection
        engine.addCollider(this);
    }
    collide(other) {
        this.struct.color.eqFrom(1.0,0.0,1.0,1.0);
    }
    destroy() {
        if (this.destroyed) return;
        this.sprites.inst.relenquish(this.struct);
        this.engine.unregister(this);
        this.destroyed = true;
        this.removeFromColliders = true;
    }
    // Advance
    step(dt,t) {
        this.frameDistanceTraveled += dt*this.IDLE_VELOCITY;
        this.struct.color.y += dt*4;
    }
    startAction(action) {
        this.frameIndex = 0; // Frame 0 is the connection point
        this.frameDirection = 1;
        this.nextAction = action;
    }
    // Returns a list of circles that collide.
    getColliders() {
        return this.frames.collision[this.frameIndex];
    }
    // Update
    update(t,wrapBackTo=0) {
        if (this.frameDistanceTraveled < this.ANIM_MPF) {
            return;
        } else {
            this.frameDistanceTraveled = wrapBackTo;
        }
        this.frames = this.sprites.animations[this.folder][this.action];
        const nframes = this.frames.frame.length;
        // Mirror if rotating
        if (this.action === 'rotate') {
            if (this.frameIndex === Math.floor(nframes/2)) {
                this.facing = -this.facing;
            }
            if (this.frameIndex === nframes-1) {
                this.startAction('move');
            }
        }
        // Update frame index
        this.frameIndex += this.frameDirection;
        if (this.frameIndex >= nframes-1) {
            this.frameDirection = -1;
        } else if (this.frameIndex <= 0) {
            this.frameDirection = 1;
        }
        // Set up next action
        this.action = this.nextAction;
    }
    // Synchronize 
    sync() {
        // Map high-level to low-level
        this.translate.eq(this.frames.control[this.frameIndex].CoM.pos);
        this.translate.x *= this.facing;
        this.translate.addEq(this.pos);
        this.transform.eqId();
        this.transform.a00 *= this.facing;
        // Write to shader
        this.struct.pos.eq(this.translate);
        this.struct.model.eqCompose(this.transform,
                                    this.frames.model[this.frameIndex]);
        this.struct.frame.eq(this.frames.frame[this.frameIndex]);
    }
    // Move, keeping track for animation.
    moveTo(newPos) {
        this.posDelta.eqSub(this.pos,newPos);
        if (this.posDelta.x * this.facing < 0 &&
            this.action !== 'rotate') {
            this.startAction('rotate');
        }
        const distance = this.posDelta.mag();
        this.frameDistanceTraveled += distance;
        this.pos.eq(newPos);
    }
}
