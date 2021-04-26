 import {
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

import * as Settings from "./settings.js";
import {TargetSprite,PhysicsSprite} from './sprite.js'
import {Brush,Splat} from './field.js';

class Glyph extends TargetSprite {
    ANIM_MPF = 1000
    IDLE_VELOCITY = 30
    NAME = 'glyph'
    PICKUP_COLLIDERS = [{pos:Vec2.Zero(),r:Settings.GLYPH_PICKUP_RADIUS}]
    HIT_COLLIDERS = [{pos:Vec2.Zero(),r:Settings.GLYPH_HIT_RADIUS}]
    constructor(res,sprites,engine,pos=Vec2.Zero(),vel=Vec2.Zero(),colorState='neutral') {
        super(
            sprites,
            engine,
            /*field=*/null,
            'elements','move',
            /*pos=*/pos,
            /*facing=*/1,
            /*angle=*/0,
            /*scale=*/1,
            /*colorState=*/colorState,
            /*sends=*/false,
            /*receives=*/true,
            /*vel=*/vel,
            /*damping = */Settings.GLYPH_DAMPING,
            /*target = */pos,
            /*targetPower = */Settings.GLYPH_THRUST,
            /*targetApproachAngle = */0,
        );
        this.shot = false;
        this.timeSinceKick = 0;
    }
    getColliders() {
        if (this.shot) {
            return this.HIT_COLLIDERS;
        } else {
            return this.PICKUP_COLLIDERS;
        }
    }
    fire(at) {
        this.sends = true;
        this.receives = false;
        this.shot = true;
        this.target = at.clone();
        this.target.subEq(this.pos);
        this.vel.eq(this.target);
        this.vel.normEq();
        this.vel.mulEq(Settings.GLYPH_SHOT_KICK);
        this.target.mulEq(999999);
        this.target.addEq(this.pos);
    }
    collide(other) {
        if (other.NAME === 'figment') {
            this.destroy();
        } else if (other.NAME === 'player') {
            other.capturedGlyphs.push(this);
            this.target = other.pos;
            this.sends = false;
            this.receives = false;
        }
    }
    step(dt,t) {
        this.timeSinceKick += dt;
        super.step(dt,t);
    }
    update(t) {
        if (this.timeSinceKick > Math.random()*Settings.GLYPH_KICK_PERIOD) {
            const theta = Math.random()*2*Math.PI;
            const kick = Vec2.Polar(Settings.GLYPH_KICK,theta);
            this.acc.addEq(kick);
            this.timeSinceKick = 0;
        }
        super.update(t);
    }
}

export class Player extends TargetSprite {
    NAME = 'player'
    constructor(res,sprites,engine,field,pos=Vec2.Zero(),vel=Vec2.Zero(),colorState='neutral') {
        super(
            sprites,
            engine,
            /*field=*/field,
            'fish','move',
            /*pos=*/pos,
            /*facing=*/1,
            /*angle=*/0,
            /*scale=*/1,
            /*colorState=*/colorState,
            /*sends=*/true,
            /*receives=*/false,
            /*vel=*/Vec2.Zero(),
            /*damping = */Settings.PLAYER_DAMPING,
            /*target = */pos,
            /*targetPower = */Settings.PLAYER_THRUST,
            /*targetApproachAngle = */0,
        );
        this.io = res.io;
        this.capturedGlyphs = [];
        // Fire!
        this.io.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 2) return;
            if (this.capturedGlyphs.length > 0) {
                const g = this.capturedGlyphs.pop(); // FIFO
                g.fire(this.engine.cursor);
            }
        });
    }
    update(t) {
        super.update(t);
        if (this.io.pressed.has('Mouse0')) {
            this.target = this.engine.cursor;
        } else {
            this.target = this.pos;
        }
    }
    collide(other) {
        if (other.NAME === 'figment') {
            this.setColor(other.colorState);
        }
    }
}

export class Figment extends TargetSprite {
    NAME = 'figment'
    constructor(res,sprites,brushes,engine,pos=Vec2.Zero(),
        colorState=Settings.COLORS[Math.floor(Math.random()*Settings.COLORS.length)],
        ) {
        super(
            sprites,
            engine,
            /*field=*/null, // No field
            /*folder=*/sprites.figmentFolders[Math.floor(Math.random()*sprites.figmentFolders.length)],
            /*action=*/'move',
            /*pos=*/pos,
            /*facing=*/1,
            /*angle=*/0,
            /*scale=*/1,
            /*colorState=*/colorState,
            /*sends=*/false,
            /*receives=*/true,
            /*vel=*/Vec2.Zero(),
            /*damping = */Settings.FIGMENT_DAMPING,
            /*target = */engine.player.pos,
            /*targetPower = */Settings.FIGMENT_THRUST,
            /*targetApproachAngle = */Math.random()*Math.PI*2,
        );
        this.brushes = brushes;
        // Create a trail if needed
        this.hasTrail = Settings.COLOR_STATES[this.colorState].trail;
        this.trail = null;
        if (this.hasTrail) {
            this.trail = new Brush(
                  this.brushes,
                  this.engine,
                  this.pos,
                  this.colorState,
            );
        }
    }
    destroy() {
        super.destroy();
        if (this.hasTrail) this.trail.destroy();
    }
    collide(other) {
        if (other.NAME === 'glyph') {
            if (Settings.COLOR_STATES[this.colorState].splat) {
                new Splat(this.brushes,
                          this.engine,
                          this.pos,
                          this.colorState,
                );
            }
            this.destroy();
        } else if (other.NAME === 'player') {
            if (Settings.COLOR_STATES[this.colorState].glyph) {
                for (let i=0; i<Settings.FIGMENT_GLYPH_REWARD; i++) {
                    const theta = Math.random()*2*Math.PI;
                    const vel = Vec2.Polar(Settings.FIGMENT_GLYPH_VELOCITY,theta);
                    const pos = this.pos.clone();
                    pos.scaledAddEq(vel,Settings.GLYPH_STARTING_OFFSET/Settings.FIGMENT_GLYPH_VELOCITY);
                    vel.addEq(this.vel);
                    new Glyph(this.res,
                              this.sprites,
                              this.engine,
                              pos,
                              vel,
                              'none',
                    );
                }
            }
            this.destroy();
        }
    }
    update(t) {
        super.update(t);
        // Check player distance
        const r2 = this.pos.distance2(this.engine.player.pos);
        if (r2 > Settings.ENTITY_FOLLOW_RADIUS2) {
            this.target = this.pos;
        } else {
            this.target = this.engine.player.pos;
        }
        if (r2 > Settings.ENTITY_VANISH_RADIUS2) {
            this.destroy();
        }
    }
}  
