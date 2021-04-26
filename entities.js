import {
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

import * as Settings from "./settings.js";
import {TargetSprite,PhysicsSprite} from './sprite.js'

export class Player extends TargetSprite {
    constructor(res,sprites,engine,field,pos=Vec2.Zero()) {
        super(
            sprites,
            engine,
            /*field=*/field,
            'fish','move',
            /*pos=*/pos,
            /*facing=*/1,
            /*angle=*/0,
            /*scale=*/1,
            /*sends=*/true,
            /*receives=*/false,
            /*vel=*/Vec2.Zero(),
            /*damping = */Settings.PLAYER_DAMPING,
            /*target = */pos,
            /*targetPower = */Settings.PLAYER_THRUST,
            /*targetApproachAngle = */0,
        );
        this.io = res.io;
    }
    update(t) {
        super.update(t);
        if (this.io.pressed.has('Mouse0')) {
            this.target = this.engine.cursor;
        } else {
            this.target = this.pos;
        }
    }
}

export class Figment extends TargetSprite {
    constructor(res,sprites,engine,pos=Vec2.Zero()) {
        super(
            sprites,
            engine,
            /*field=*/null, // No field
            /*folder=*/sprites.folders[Math.floor(Math.random()*sprites.folders.length)],
            /*action=*/'move',
            /*pos=*/pos,
            /*facing=*/1,
            /*angle=*/0,
            /*scale=*/1,
            /*sends=*/false,
            /*receives=*/true,
            /*vel=*/Vec2.Zero(),
            /*damping = */Settings.FIGMENT_DAMPING,
            /*target = */engine.player.pos,
            /*targetPower = */Settings.FIGMENT_THRUST,
            /*targetApproachAngle = */Math.random()*Math.PI*2,
        );
    }
    update(t) {
        super.update(t);
        // Check player distance
        const r2 = this.pos.distance2(this.engine.player.pos);
        if (r2 > Settings.ENTITY_FOLLOW_RADIUS2) {
            this.target = this.pos;
            return;
        } else {
            this.target = this.engine.player.pos;
        }
        this.sleeping = this.vel.mag2() < Settings.ENTITY_SLEEP_VELOCITY2 
                        && this.target === this.pos;
    }
}  
