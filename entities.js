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
    fire(from,at) {
        this.sends = true;
        this.receives = false;
        this.shot = true;
        this.pos.eq(from);
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
            this.scale = 1.5;
            this.target = other.pos;
            this.sends = false;
            this.receives = false;
        }
    }
    step(dt,t) {
        this.timeSinceKick += dt;
        if (this.scale > 1) {
            this.scale -= dt*1;
        }
        if (this.scale < 1) {
            this.scale = 1;
        }
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
                g.fire(this.pos,this.engine.cursor);
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
            /*target = */pos,
            /*targetPower = */Settings.FIGMENT_THRUST,
            /*targetApproachAngle = */0,
        );
        engine.figments.add(this);
        if (colorState === 'neutral') this.engine.nDarkFigments += 1;
        else this.engine.nFigments += 1;
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
        this.timeSinceAIUpdate = 0.0;
        this.wanderUpdateCountdown = 0.0;
        this.wandering = false;
    }
    destroy() {
        super.destroy();
        this.engine.figments.delete(this);
        if (this.hasTrail) this.trail.destroy();
        if (this.colorState === 'neutral') this.engine.nDarkFigments -= 1;
        else this.engine.nFigments -= 1;
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
    step(dt,t) {
        this.timeSinceAIUpdate += dt;
        this.wanderUpdateCountdown -= dt;
        super.step(dt,t);
    }
    // Measures how much we like the given point
    affinity(pos) {
        this.engine.field.read(pos);
        return this.engine.field.f.dot(this.color);
    }
    // Sets us to target a wander point
    wander() {
        if (this.wanderUpdateCountdown > 0) {
            return;
        } else {
            this.wanderUpdateCountdown = Settings.AI_WANDER_PERIOD * Math.random();
        }
        const state = Settings.COLOR_STATES[this.colorState];
        // Pick a prospective wandering point
        const point = Vec2.Polar(
            state.wanderLength*Math.random(),
            Math.random()*Math.PI*2,
        );
        point.addEq(state.wanderDirection);
        point.addEq(this.pos);
        // Check to see if it's desirable
        if (this.affinity(this.pos) < state.wanderAffinityBias
                                      + this.affinity(point)) {
            // Set our target
            this.targetApproachAngle = 0;
            this.targetPower = state.wanderPower;
            this.target = point;
            this.target.x += Settings.WANDER_OUTSIDE_CLOUD*Math.cos(Math.random()*Math.PI*2);
            this.target.y += Settings.WANDER_OUTSIDE_CLOUD*Math.sin(Math.random()*Math.PI*2);
        }
    }
    // Reacts to another entity according to the rule.
    aiReact(other,rule) {
        this.wanderUpdateCountdown = 0;
        this.targetPower = rule.thrust;
        this.targetApproachAngle = rule.angle;
        this.target = other.pos;
    }
    // Returns the highest-priority rule
    // that matches the color of other.
    colorRule(rules,other) {
        let rule = null;
        if (!rules.any && !rules[other.colorState]) return null;
        const r = Math.sqrt(other.pos.distance2(this.pos));
        if (!!rules.any && r <= rules.any.r) {
            rule = rules.any;
        }
        if (!!rules[other.colorState]) {
            const specificRule = rules[other.colorState];
            if (rule === null || specificRule.priority >= rule.priority) {
                if (r <= specificRule.r) {
                    rule = specificRule
                }
            }
        }
        return rule;
    }
    update(t) {
        super.update(t);
        // Check player distance
        if (this.timeSinceAIUpdate > Settings.AI_TICK_PERIOD * Math.random()) {
            this.timeSinceAIUpdate = 0;
            // Resolve rules
            const rules = Settings.COLOR_STATES[this.colorState].ai;
            let other = null;
            let rule = null;
            // Check if they have an interest in the player
            if (!!rules.player) {
                const relevantRule = this.colorRule(rules.player,this.engine.player);
                if (relevantRule !== null) {
                    if (rule === null || rule.priority < relevantRule.priority) {
                        rule = relevantRule;
                        other = this.engine.player;
                    }
                }
            }
            // Check if they have an interest in other figments
            if (!!rules.figment) {
                for (const figment of this.engine.figments) {
                    const relevantRule = this.colorRule(rules.figment,figment);
                    if (relevantRule !== null) {
                        if (rule === null || rule.priority < relevantRule.priority) {
                            rule = relevantRule;
                            other = figment;
                        }
                    }
                }
            }
            if (rule !== null) {
                this.wandering = false;
                this.aiReact(other,rule);
            } else {
                if (!this.wandering) {
                    this.target = this.pos;
                    this.wandering = true;
                }
                this.wander();
            }
        }
    }
}  
