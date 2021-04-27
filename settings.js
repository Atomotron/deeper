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
const wanderLength = 300;
export const WANDER_OUTSIDE_CLOUD = 200;
const wanderPower = 400;
const wanderAffinityBias = -0.1;
const CHASE = 0;
const AVOID = Math.PI;
export const COLOR_STATES = {
    'pink' : {
        color            : Vec4.From(1.0,0.0,0.0,0.0),
        fieldSensitivity : Vec4.From(0.0,1.0,1.0,0.0),
        trail: false,
        splat: true,
        glyph: true,
        ai: {
            player:{
                any:{
                    priority: 10,
                    r   : 400,
                    thrust: 700,
                    angle : AVOID + Math.PI/2 + 0.1,
                },
            },
            figment:{
                neutral:{
                    priority: 5,
                    r   : 400,
                    thrust: 1000,
                    angle : CHASE,
                },
            },
        },
        wanderLength: wanderLength,
        wanderPower: wanderPower, 
        wanderAffinityBias: wanderAffinityBias,  
        wanderDirection: Vec2.Zero(),     
    },
    'yellow' : {
        color            : Vec4.From(0.0,1.0,0.0,0.0),
        fieldSensitivity : Vec4.From(1.0,0.0,1.0,0.0),
        trail: false,
        splat: true,
        glyph: true,
        ai: {
            figment:{
                neutral:{
                    priority: 5,
                    r   : 100,
                    thrust: 500,
                    angle : AVOID,
                },
            },
        },
        wanderLength: wanderLength,
        wanderPower: wanderPower, 
        wanderAffinityBias: wanderAffinityBias,  
        wanderDirection: Vec2.Zero(),     
    },
    'blue' : {
        color            : Vec4.From(0.0,0.0,1.0,0.0),
        fieldSensitivity : Vec4.From(1.0,1.0,0.0,0.0),
        trail: false,
        splat: true,
        glyph: true,
        ai: {
            player:{
                any:{
                    priority: 10,
                    r   : 400,
                    thrust: 500,
                    angle : CHASE,
                },
            },
        },
        wanderLength: wanderLength,
        wanderPower: wanderPower,  
        wanderAffinityBias: wanderAffinityBias,
        wanderDirection: Vec2.Zero(),          
    },
    'neutral' : {
        color            : Vec4.From(0.0,0.0,0.0,1.0),
        fieldSensitivity : Vec4.From(1.0,1.0,1.0,0.0),
        trail: true,
        splat: false,
        glyph: false,
        ai: {
            player:{
                any:{
                    priority: 10,
                    r   : 4000,
                    thrust: 100,
                    angle : CHASE,
                },
            },
            // Avoid pink figments
            figment:{
                pink:{
                    priority: 15,
                    r   : 400,
                    thrust: 1100,
                    angle : AVOID - 0.8*Math.PI/2,
                },
            },
        },
        wanderLength: 0,
        wanderPower: wanderPower,   
        wanderAffinityBias: wanderAffinityBias,   
        wanderDirection: Vec2.From(0,0),      
    },
    // No color setting at all
    'none' : {
        color            : Vec4.From(0.0,0.0,0.0,0.0),
        fieldSensitivity : Vec4.From(0.0,0.0,0.0,0.0),
        trail: false,
        splat: false,
        glyph: false,
        ai: {},
        wanderLength: 0,
        wanderPower: 0,
        wanderAffinityBias: 0,    
    }
}

// UI
export const SCREEN_FADE_SPEED = 1/3;
export const MESSAGE_FADE = 0.5;
export const MESSAGE_OPACITY_START = 3/MESSAGE_FADE;
export const MESSAGE_OPACITY_EXTRA_PER_CHARACTER = (1/15)/MESSAGE_FADE;

// Player
export const PLAYER_START = Vec2.From(-80,-170*8);
export const PLAYER_DAMPING = 1;
export const PLAYER_THRUST = 2000;
export const BOUNCE_SOUND_SPEED = 2;

// Spawning
export const MAX_DARK_FIGMENTS = 3; // Dark figments will stop spawning once this many exist.
export const DARK_FIGMENT_SPAWN_PERIOD = 60; // One spawns every this many seconds on average
export const MAX_FIGMENTS = 40; // Figments will stop spawning once this many exist.
export const FIGMENT_SPAWN_PERIOD = 15;

// Camera settings
export const CAMERA_SPEED = 2.0;
export const CAMERA_ZOOM_SPEED = 10;
export const MAX_ZOOM = 512;
export const MIN_ZOOM = 256;
export const START_ZOOM = (MIN_ZOOM + MAX_ZOOM)*0.5;
export const ZOOM_SPEED = 0.26; 
export const CAMERA_MAX_DISTANCE = MIN_ZOOM; // Max distance of camera from player

// Entity physics
export const FIGMENT_DAMPING = 1;
export const FIGMENT_THRUST = 1000;
export const GLYPH_DAMPING = 0.4;
export const GLYPH_THRUST = 2000;

// Glyphs
export const GLYPH_PICKUP_RADIUS = 50; // Get this close to a glyph to pick it up
export const GLYPH_HIT_RADIUS    = 1;  // Size of a glyph as far as shooting figments is concerned
export const FIGMENT_GLYPH_REWARD = 3;
export const FIGMENT_GLYPH_VELOCITY = 20;
export const GLYPH_STARTING_OFFSET = 70;
export const GLYPH_SHOT_KICK = 200;

export const GLYPH_KICK_PERIOD = 6;
export const GLYPH_KICK = 60;

// AI
export const AI_TICK_PERIOD = 1.0; // On average, the AI updates every half this many seconds.
export const AI_WANDER_PERIOD = 6.0;
const ENTITY_VANISH_RADIUS = MAX_ZOOM*4;
const ENTITY_SLEEP_VELOCITY = 1; // Entities halt simulation when they go below this velocity.

// Color physics
export const COLOR_FORCE_STRENGTH = -30;
export const COLOR_FORCE_DAMPING  = 0.02;

// Splat/trail settings
export const SPLAT_ALPHA = 1.0;
export const TRAIL_ALPHA = 0.4;
export const SPLAT_SCALE = 4/3;
export const TRAIL_SCALE = 4;

// Animation speed
export const ANIM_MPF = 24
export const IDLE_VELOCITY = 24

// Sprite effect padding
export const SPRITE_MODEL_PADDING = 1.4;

// Squared constants
export const ENTITY_VANISH_RADIUS2 = ENTITY_VANISH_RADIUS * ENTITY_VANISH_RADIUS;
export const ENTITY_SLEEP_VELOCITY2 = ENTITY_SLEEP_VELOCITY * ENTITY_SLEEP_VELOCITY;

// Messages
export const MESSAGES = {
yellow: [
"Things moved slowly.",
"It was peaceful there.",
"I sat in the sunlight.",
"It was warm that day.",
"I spent time relaxing.",
"She told me to calm down.",
"He made sure I was comfortable.",
"It was easy to sit still.",
"I smiled at them.",
"They were content.",
"The wind was cool.",
"I smelled a warm bakery.",
"The fireplace crackled.",
"She looked so cozy.",
"He was asleep.",
"They were resting.",
"They were at peace.",
"I saw how nice it was.",
"The trees waved.",
"I think it was springtime.",
"That summer was hot.",
"It was turning fall colors.",
"There were butterflies.",
"It made me sleepy.",
"The rain sounded lovely.",
"The stars were out.",
],
pink: [
"She hugged me.",
"He hugged me.",
"They hugged me.",
"I hugged them back.",
"I heard them singing.",
"I saw a firefly.",
"I was in love.",
"I loved it.",
"I was so happy.",
"They were so happy.",
"She held me tight.",
"He said it would be okay.",
"We laughed together.",
"We watched it spin.",
"They were playing outside.",
"I played with them.",
"I danced.",
"We danced.",
"It was like magic.",
"I felt a kiss on my head.",
"They were kind.",
"It was fun.",
"We were together.",
"I forgot about the world.",
"It was just the two of us.",
"No one could touch us.",
"It was us against the world.",
"How calm she was.",
"He was delightful.",
"They told me stories.",
"I felt loved.",
],
blue:[
"I did it.",
"I made it.",
"I did it myself.",
"They helped me.",
"It was an accomplishment.",
"I succeeded.",
"She succeeded.",
"He succeeded.",
"We all worked together.",
"I knew we would win.",
"I felt I could do it.",
"I finally made it.",
"I was close to winning.",
"My heart was pounding.",
"I was so excited.",
"We were cheering.",
"We all clapped.",
"It was amazing.",
"I'd done it.",
"I finally won.",
"I knew I was almost there.",
"There was the finish line.",
"I could taste it.",
"Victory was sweet.",
"I was so proud.",
"They said they were proud.",
"He was proud of me.",
"She was proud of me.",
"I was on cloud nine.",
"What a rush!",
"I'd never been so excited.",
"The tension was killing me.",
],
neutral: [
"They hated me.",
"She didn't love me.",
"He didn't care.",
"I was a failure.",
"I'd never make it.",
"They looked down on me.",
"I felt like a loser.",
"I hated myself.",
"It was all for nothing.",
"It was a nightmare.",
"I'd hurt them.",
"I would never forgive myself.",
"I was wrong.",
"It was all wrong.",
"I felt victimized.",
"I messed up.",
"She scared me.",
"He was angry.",
"She was so mad.",
"They were angry at me.",
"They scared me.",
"I was afraid of them.",
"It all went wrong.",
"That's when it fell apart.",
"I fell to pieces.",
"I couldn't do it.",
"He was gone.",
"She left.",
"They left me.",
"I'd ruined it.",
"Everything sucked.",
"No one could ever love me.",
"What a waste of space.",
],
}
