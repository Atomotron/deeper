import {
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';
export const DISPLAY_COLOR_MATRIX = Mat4.Id().composeFromEq(
    255, 233,   0,  200,
    216, 208, 154,  200,
    255,  26, 255,  200,
    255, 255, 255, 255,
).mulEq(1/256);

// Color stuff
export const COLORS = ['pink','yellow','blue','neutral'];
export const COLOR_STATES = {
    'pink' : {
        color            : Vec4.From(1.0,0.0,0.0,0.0),
        fieldSensitivity : Vec4.From(0.0,1.0,1.0,0.0),
        trail: false,
        splat: true,
        glyph: true,
    },
    'yellow' : {
        color            : Vec4.From(0.0,1.0,0.0,0.0),
        fieldSensitivity : Vec4.From(1.0,0.0,1.0,0.0),
        trail: false,
        splat: true,
        glyph: true,
    },
    'blue' : {
        color            : Vec4.From(0.0,0.0,1.0,0.0),
        fieldSensitivity : Vec4.From(1.0,1.0,0.0,0.0),
        trail: false,
        splat: true,
        glyph: true,
    },
    'neutral' : {
        color            : Vec4.From(0.0,0.0,0.0,1.0),
        fieldSensitivity : Vec4.From(1.0,1.0,1.0,0.0),
        trail: true,
        splat: false,
        glyph: false,
    },
    // No color setting at all
    'none' : {
        color            : Vec4.From(0.0,0.0,0.0,0.0),
        fieldSensitivity : Vec4.From(0.0,0.0,0.0,0.0),
        trail: false,
        splat: false,
        glyph: false,
    }
}

// Camera settings
export const CAMERA_SPEED = 2.0;
export const CAMERA_ZOOM_SPEED = 10;
export const MAX_ZOOM = 512;
export const MIN_ZOOM = 256;
export const START_ZOOM = (MIN_ZOOM + MAX_ZOOM)*0.5;
export const ZOOM_SPEED = 0.26; 
export const CAMERA_MAX_DISTANCE = MIN_ZOOM; // Max distance of camera from player

// Entity physics
export const PLAYER_DAMPING = 1;
export const PLAYER_THRUST = 2000;
export const FIGMENT_DAMPING = 1;
export const FIGMENT_THRUST = 1000;
export const GLYPH_DAMPING = 0.1;
export const GLYPH_THRUST = 1000;

// Glyphs
export const GLYPH_PICKUP_RADIUS = 50; // Get this close to a glyph to pick it up
export const GLYPH_HIT_RADIUS    = 1;  // Size of a glyph as far as shooting figments is concerned
export const FIGMENT_GLYPH_REWARD = 3;
export const FIGMENT_GLYPH_VELOCITY = 20;
export const GLYPH_STARTING_OFFSET = 70;
export const GLYPH_SHOT_KICK = 200;

export const GLYPH_KICK_PERIOD = 2;
export const GLYPH_KICK = 50;

// AI
const ENTITY_FOLLOW_RADIUS = 512;
const ENTITY_VANISH_RADIUS = 2048;
const ENTITY_SLEEP_VELOCITY = 1; // Entities halt simulation when they go below this velocity.

// Color physics
export const COLOR_FORCE_STRENGTH = -30;
export const COLOR_FORCE_DAMPING  = 0.02;

// Splat/trail settings
export const SPLAT_ALPHA = 1.0;
export const TRAIL_ALPHA = 0.1;
export const SPLAT_SCALE = 4/3;
export const TRAIL_SCALE = 4;

// Animation speed
export const ANIM_MPF = 24
export const IDLE_VELOCITY = 24

// Sprite effect padding
export const SPRITE_MODEL_PADDING = 1.2;

// Squared constants
export const ENTITY_FOLLOW_RADIUS2 = ENTITY_FOLLOW_RADIUS*ENTITY_FOLLOW_RADIUS;
export const ENTITY_VANISH_RADIUS2 = ENTITY_VANISH_RADIUS * ENTITY_VANISH_RADIUS;
export const ENTITY_SLEEP_VELOCITY2 = ENTITY_SLEEP_VELOCITY * ENTITY_SLEEP_VELOCITY;
