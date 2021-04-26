import {
    // Drawing stuff
    Geometry,
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

import {Quad} from './quad.js';
import {colliderMixin} from './collider.js';
import * as Settings from "./settings.js";

const NUMBER_POSTFIX_REGEX = /\d+\.png$/;
const ANIM_FRAME_FOLDER_REGEX = /^.*\//;

// A layer of sprites, all of the same type.
export class Sprites extends Quad {
    constructor(res,
        shadername,
        texturename,
        instances=1,
        configuration={}
        ) {
        // Default configuration
        Object.assign(configuration, {
            vertex:{divisor:0,stream:false},
            pos   :{divisor:1,stream:true},
            model :{divisor:1,stream:true},
            frame :{divisor:1,stream:true},
            color :{divisor:1,stream:true},
        });
        const texture = res.images[texturename];
        const shader = res.shaders[shadername];
        const schema = shader.schema(configuration);
        super(res.gl,schema,instances);
        this.texture = texture;
        this.shader = shader;
        this.res = res;
    }
}

export class AnimatedSprites extends Sprites {
    constructor(res,
        shadername="sprite",
        texturename="sprites",
        instances=1,
        configuration={}
        ) {
        super(res,shadername,texturename,instances,configuration);
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
                const frames = [];
                for (const name of names) {
                    frames.push(name)
                }
                // Write to animation object
                if (!this.animations[folder]) this.animations[folder] = {};
                this.animations[folder][action] = frames;
            }
        }
    }
}

export class Sprite {
    constructor(sprites,engine,spritename,pos=Vec2.Zero(),facing=1,angle=0,scale=1) {
        this.destroyed = false;
        this.sprites = sprites;
        this.engine = engine;
        this.pos = pos;
        this.facing = facing;
        this.angle = angle;
        this.scale = scale;
        this.setSprite(spritename);
        // Low-level struct data - determined by high-level.
        this.translate = Vec2.Zero();
        this.transform = Mat2.Id();
        this.color = Vec4.Zero();
        this.color.w = 1.0; // alpha = 1
        // Acquire a struct from the sprite stack
        this.struct = sprites.inst.acquire();
        // Register for synchronization
        this.engine.register(this);
        //this.sync();
    }
    setSprite(spritename) {
        this.spritename = spritename;
        const sheet = this.sprites.texture.sheet;
        this.model      = sheet.model[spritename];
        this.frame      = sheet.frame[spritename];
        this.control    = sheet.control[spritename];
        this.collision  = sheet.collision[spritename];
    }
    destroy() {
        if (this.destroyed) return;
        this.sprites.inst.relenquish(this.struct);
        this.engine.unregister(this);
        this.destroyed = true;
    }
    // The default sprite doesn't simulate on its own.
    step(dt,t) {}
    // The default sprite doesn't update
    update(t) {}
    // However, we DO need to update pos, facing and rotation.
    sync() {
        // Update low-level transformation info
        // Translation
        this.translate.eqZero()
        this.translate.subEq(this.control.CoM.pos);
        this.translate.transformEq(this.transform);
        this.translate.x *= this.facing;
        this.translate.addEq(this.pos);
        // Transformation
        this.transform.eqId();
        this.transform.a00 = this.facing * this.scale;
        this.transform.a11 = this.scale;
        this.transform.eqRotate(this.transform,this.angle);
        // Write data to struct for upload to GPU
        this.struct.frame.eq(this.frame);
        this.struct.pos.eq(this.translate);
        this.struct.model.eqCompose(this.transform,this.model);
        this.struct.color.eq(this.color);
    }    
}

export class PhysicsSprite extends colliderMixin(Sprite) {
    constructor(
        sprites,
        engine,
        field,
        spritename,
        pos=Vec2.Zero(),
        facing=1,
        angle=0,
        scale=1,
        sends=false,
        receives=true,
        vel=Vec2.Zero(),
        damping = 1,
    ) {
        super(sprites,engine,spritename,pos,facing,angle,scale);
        this.vel = vel;
        this.field = field;
        this.fieldSensitivity = Vec4.From(1.0,1.0,1.0,0.0);
        this.fieldForce = Vec2.Zero();
        this.fieldDamping = 0;
        this.acc = Vec2.Zero(); // Acceleration accumulator
        this.damping = damping;
        this.colliderConstructor(sends,receives);
    }
    destroy() {
        super.destroy();   
        this.removeFromColliders = true;
    }
    getColliders() {
        return this.collision; // See Sprite.setSprite
    }
    findFieldForce() {
        this.field.read(this.pos);
        this.fieldForce.eqFrom(
            this.field.dfdx.dot(this.fieldSensitivity),
            this.field.dfdy.dot(this.fieldSensitivity)
        );
        this.fieldForce.mulEq(Settings.COLOR_FORCE_STRENGTH);
        this.fieldDamping = this.field.f.dot(this.fieldSensitivity) * Settings.COLOR_FORCE_DAMPING;
        this.acc.addEq(this.fieldForce);
    }
    step(dt,t) {
        // Apply typical forces
        this.findFieldForce();
        // Simulate trajectory
        const beta = -(this.damping + this.fieldDamping);
		this.acc.mulEq(1/beta);
		const dampingFactor = Math.exp(beta*dt);
		// Compute v-alpha
		this.vel.addEq(this.acc);
		// Compute new position
		this.pos.scaledAddEq(this.vel, (dampingFactor-1)/beta )
		this.pos.scaledAddEq(this.acc, -dt);
		// Compute new velocity
		this.vel.mulEq(dampingFactor);
		this.vel.subEq(this.acc);
		// Reset acceleration accumulator and return.
		this.acc.eqZero();
		super.step(dt,t);
    }
}

// One particular sprite
export class AnimatedSprite extends PhysicsSprite {
    constructor(
        sprites,
        engine,
        field,
        folder='granny',action='move', // These replace spritename!
        pos=Vec2.Zero(),
        facing=1,
        angle=0,
        scale=1,
        sends=false,
        receives=true,
        vel=Vec2.Zero(),
        damping = 1,
        ) {
        const spritename = sprites.animations[folder][action][0];
        super(sprites,engine,field,spritename,pos,facing,
              angle,scale,sends,receives,vel,damping);
        this.folder = folder;
        this.action = action;
        // ANIMATION STATE
        this.oldPos = Vec2.Zero();
        this.tail = Vec2.Zero();
        this.odometer = Math.random()*Settings.ANIM_MPF;
        this.nextAction = action;
        this.frameIndex = 0;
        this.frames = [];
        this.trueFrameIndex = 0;
        this.frameDirection = 1;
        // Set up animation frames
        this.update(0);
        // Register for collision detection
        engine.addCollider(this);
    }
    // Advance
    step(dt,t) {
        super.step(dt,t);
        // Tail, physics, odometer
        this.tail.eqSub(this.pos,this.oldPos);
        this.oldPos.eq(this.pos);
        this.odometer += this.tail.mag() + dt*Settings.IDLE_VELOCITY;
    }
    startAction(action) {
        this.frameIndex = 0; // Frame 0 is the connection point
        this.frameDirection = 1;
        this.nextAction = action;
    }
    // Update
    update(t) {        
        // Set color based on field sensitivity
        this.color.x = Math.exp(-this.fieldSensitivity.x);
        this.color.y = Math.exp(-this.fieldSensitivity.y);
        this.color.z = Math.exp(-this.fieldSensitivity.z);
        this.color.w = 1.0;
        // Start rotation if moving different direction from facing
        if (this.action !== 'rotate') {
            if (-this.tail.x * this.facing < 0) {
                // Moving in a direction we aren't facing
                this.startAction('rotate');
            }
        }
        if (this.odometer < Settings.ANIM_MPF) {
            return;
        } else {
            this.odometer = 0;
        }
        this.frames = this.sprites.animations[this.folder][this.action];
        const nframes = this.frames.length;
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
        // Save frame name
        this.setSprite(this.frames[this.frameIndex]);
    }
    // Synchronize 
    sync() {
        super.sync();
    }
    // Move, keeping track for animation.
    moveTo(newPos) {
        this.pos.eq(newPos);
    }
}

export class TargetSprite extends AnimatedSprite {
    constructor(
        sprites,
        engine,
        field,
        folder='granny',action='move', // These replace spritename!
        pos=Vec2.Zero(),
        facing=1,
        angle=0,
        scale=1,
        sends=false,
        receives=true,
        vel=Vec2.Zero(),
        damping = 1,
        target = null,
        targetPower = 1000,
        targetApproachAngle = 0, 
        ) {
        super(sprites,engine,field,folder,action,pos,facing,
              angle,scale,sends,receives,vel,damping);
        if (target === null) target = pos.clone();
        this.target = target;
        this.targetDelta = Vec2.Zero();
        this.targetPower = targetPower;
        this.targetApproachAngle = targetApproachAngle;
    }
    step(dt,t) {
        this.targetDelta.eqSub(this.target,this.pos);
        this.targetDelta.normEq();
        this.targetDelta.rotateEq(this.targetApproachAngle);
        this.acc.scaledAddEq(this.targetDelta,this.targetPower*dt);
        super.step(dt,t);
    }
}
