import {
    // Setup
    load,compileRenderer,
    // Drawing stuff
    CanvasRenderbuffer,Framebuffer,Geometry,
    // Passes
    SUM,DrawPass,ClearPass,
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
    Engine,
} from './engine/archimedes.js';

import * as Settings from "./settings.js";
import {Quad} from './quad.js';
import {Sprites,AnimatedSprites,Sprite,AnimatedSprite,TargetSprite} from './sprite.js';
import {collisions} from './collider.js';
import {Field,Brushes,Brush,Splat} from './field.js';

import {Player,Figment} from './entities.js';


function setLoaderBarWidth(id,complete,total) {
    const e = document.getElementById(id);
    let width = 100;
    if (total > 0) {
        width = 100 * complete / total;
    }
    e.style.width = `${width}%`;
}

function escapeMonospaceHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/ /g, "&nbsp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;")
         .replace(/\n/g, "<br>");
}
let failed = false;

let tileMipSettings = {
    minFilter: 'LINEAR_MIPMAP_LINEAR',
    magFilter: 'LINEAR',
    wrapS: 'REPEAT',
    wrapT: 'REPEAT',
    stretch: true,
    premultiply: false,
};

load({
    canvas:document.querySelector("canvas"),
    shaders: {
        vertex: {
            sprite: new URL("shader/sprite.vert", document.baseURI),
            brush: new URL("shader/brush.vert", document.baseURI),
            background: new URL("shader/background.vert", document.baseURI),
            //query: new URL("shader/query.vert", document.baseURI),
        },
        fragment:{
            blit: new URL("shader/blit.frag", document.baseURI),
            sprite: new URL("shader/sprite.frag", document.baseURI),
            colorblit: new URL("shader/colorblit.frag", document.baseURI),
            background: new URL("shader/background.frag", document.baseURI),
        },
        programs: {
            sprite:['sprite','sprite'],
            brush:['brush','colorblit'],
            background:['background','background'],
        },
    },
    images: {
        level: new URL("image/testgauntlet.png", document.baseURI),
        sparkles: new URL("image/sparkles.png", document.baseURI),
        sprites: new URL("image/texture.png", document.baseURI),
        brushes: new URL("image/brushes.png", document.baseURI),
        pattern_yellow: new URL("image/pattern_yellow.png", document.baseURI),
        pattern_pink: new URL("image/pattern_pink.png", document.baseURI),
        pattern_blue: new URL("image/pattern_blue.png", document.baseURI),
        pattern: new URL("image/pattern.png", document.baseURI),
    },
    imageSettings: {
        level: {
            minFilter: 'LINEAR',
            magFilter: 'LINEAR',
            wrapS: 'REPEAT',
            wrapT: 'CLAMP_TO_EDGE',
            stretch: false,
        },
        sprites: {
            minFilter: 'LINEAR',
            magFilter: 'LINEAR',
            wrapS: 'CLAMP_TO_EDGE',
            wrapT: 'CLAMP_TO_EDGE',
            stretch: false,
        },
        pattern_yellow: tileMipSettings,
        pattern_pink:   tileMipSettings,
        pattern_blue:   tileMipSettings,
        pattern:  tileMipSettings,
        sparkles:  tileMipSettings,
    },
    sounds: {
        // chemical_absorb.ogg  chemical_cloud.ogg  happy_ding.ogg  reject_loop.ogg  sad_ding.ogg  shot.ogg
        chemical_absorb: new URL("sound/chemical_absorb.ogg", document.baseURI),
        chemical_cloud: new URL("sound/chemical_cloud.ogg", document.baseURI),
        element_pickup: new URL("sound/element_pickup.ogg", document.baseURI),
        sad_ding: new URL("sound/sad_ding.ogg", document.baseURI),
        reject_loop: new URL("sound/reject_loop.ogg", document.baseURI),
        shot: new URL("sound/shot.ogg", document.baseURI),
    },
    streams: {
        ambience: new URL("sound/ambience.ogg", document.baseURI),
    },
    spritesheets: {
        sprites: new URL("image/texture.geom.json", document.baseURI),
        brushes: new URL("image/brushes.geom.json", document.baseURI),
    },
    skipAudioWait: false,
},{
    vertex : (loaded,total) => setLoaderBarWidth('vertex',loaded,total),
    fragment : (loaded,total) => setLoaderBarWidth('fragment',loaded,total),
    image : (loaded,total) => setLoaderBarWidth('image',loaded,total),
    sound : (loaded,total) => setLoaderBarWidth('sound',loaded,total),
    stream: (loaded,total) => setLoaderBarWidth('stream',loaded,total),
    spritesheet: (loaded,total) => setLoaderBarWidth('spritesheet',loaded,total),
    waitingForInteraction : () => {
        if (failed) return;
        document.getElementById('loader').style.display = 'none';
        document.getElementById('clicktostart').style.display = 'block';
    },
}).then( (res) => {
window.res = res;
// Disable click to start message / loading screen
document.getElementById('overlay').style.display = 'none';
const gl = res.gl;

// AMBIENCE
res.streams.ambience.loop = true;
const ambienceNode = res.io.adc.createMediaElementSource(res.streams.ambience);
ambienceNode.connect(res.io.mixer);
window.node = ambienceNode;
res.streams.ambience.play();

// CAMERA
const camera = Mat2.Id();
const cameraPos = Vec2.From(0,0);
let cameraSize = Settings.START_ZOOM;
let cameraSizeTarget = cameraSize;
res.io.canvas.addEventListener('wheel',
    (e) => {
        cameraSizeTarget *= Math.exp(Settings.ZOOM_SPEED * Math.sign(event.deltaY));
        if (cameraSizeTarget > Settings.MAX_ZOOM) cameraSizeTarget = Settings.MAX_ZOOM;
        if (cameraSizeTarget < Settings.MIN_ZOOM) cameraSizeTarget = Settings.MIN_ZOOM;
    }
);

const cameraInv = Mat2.Inverse(camera);
const cameraTarget = cameraPos.clone();

// MOUSE
const cursor = Vec2.From(0.0,0.0);

// BACKGROUND
const bgLayer = new Quad(gl,
    res.shaders.background.schema({vertex:{divisor:0,stream:false}}),
    1,
);
const bgModel = res.images.level.sheet.model.all.clone();
bgModel.mulEq(8);
const bgModelInv = bgModel.inverse();
const bgPos = Vec2.From(0,-bgModel.a11);

// PHYSICS FIELD
const field = new Field(res,res.images.level,bgModelInv,bgPos);

// TIME
const time = Vec1.From(0);

// SPRITE LAYER
const spriteModelPadding = Vec1.From(Settings.SPRITE_MODEL_PADDING);
const sprites = new AnimatedSprites(res);

// BRUSH LAYER
const brushes = new Brushes(res,"brush",'brushes',1,{},bgModel.a00);


// Make an instance
/*
window.sprite = layer.inst.acquire();
window.sprite.pos.eqFrom(0.0,0.0);
window.sprite.model.eq(res.images.sprites.sheet.model['floor.png']);
window.sprite.frame.eq(res.images.sprites.sheet.frame['floor.png']);
layer.sync(res.gl);*/

// Set up render sequence

const sequence = [    
    SUM(DrawPass,{
        framebuffer: field.fb,
        name: "Paint on Field",
        shader: brushes.shader,
        uniforms: {
            cameraInv: bgModelInv,
            cameraPos: bgPos,  
        },
        samplers: {
            source: brushes.texture
        },
        draw: (gl) => brushes.draw(gl),
    }),
    ClearPass,
    SUM(DrawPass,{
        name: "Draw Background",
        shader: res.shaders.background,
        uniforms: {
            cameraPos:cameraPos,
            camera:camera,
            bgModelInv:bgModelInv,
            bgPos:bgPos,
            time: time,
        },
        samplers: {
            source: field.fb,
            rPattern: res.images.pattern_pink,
            gPattern: res.images.pattern_yellow,
            bPattern: res.images.pattern_blue,
            wPattern: res.images.pattern,
        },
        draw: (gl) => bgLayer.draw(gl),
    }),
    SUM(DrawPass,{
        name: "Draw Sprites",
        shader: sprites.shader,
        uniforms: {
            cameraInv: cameraInv,
            cameraPos: cameraPos,  
            time: time, 
            displayColorMatrix: Settings.DISPLAY_COLOR_MATRIX,
            spriteModelPadding: spriteModelPadding,
        },
        samplers: {
            source: sprites.texture,
            noise: res.images.sparkles,
        },
        draw: (gl) => sprites.draw(gl),
    }),
];
const [render,env] = compileRenderer(sequence);


const CAM_VEL = 3.0;
class DeeperEngine extends Engine {
    constructor(res,render,env,streams) {
        super(res,render,env,streams);
        this.cursor = cursor;
        // Pausing
        window.addEventListener('keydown', (e) => {
            if (e.code === "Space") {
                this.paused = !this.paused;
            }
        });
        // Collider setup
        this.colliders = [];
        this.newColliders = [];
        this.colliderBackBuffer = [];
        // Figment setup
        this.figments = new Set();
        
        // Sprite creation
        this.player = new Player(res,sprites,this,field,Settings.PLAYER_START.clone());
        cameraPos.eq(this.player.pos);
        
        // Generate a bunch of sprites
        const names = Array.from(Object.keys(sprites.animations));
        for (let i=0; i<200; i++) {
            /*const s = new Figment(
                res,
                sprites,
                brushes,
                this,
                Vec2.From(Math.random()-0.5,-Math.random()).mulEq(4096),
                //'neutral',
            );*/
        }
        this.field = field;
        this.nDarkFigments = 0;
        this.nFigments = 0;
        this.figmentSpawnCountdown = 0;
        this.darkFigmentSpawnCountdown = 0;
    }
    stepSimulation(dt,t) {
        this.figmentSpawnCountdown -= dt;
        this.darkFigmentSpawnCountdown -= dt;
        field.read(this.cursor);
        // Update camera pos
        cameraSize += dt*Settings.CAMERA_ZOOM_SPEED*(cameraSizeTarget - cameraSize);
        cameraTarget.zeroEq();
        cameraTarget.addEq(this.player.target);
        cameraTarget.subEq(this.player.pos);
        cameraTarget.mulEq(0.5);
        if (cameraTarget.mag() > Settings.CAMERA_MAX_DISTANCE) {
            cameraTarget.normEq();
            cameraTarget.mulEq(Settings.CAMERA_MAX_DISTANCE);
        }
        cameraTarget.addEq(this.player.pos);
        if (cameraTarget.y + cameraSize > 0) {
            cameraTarget.y =  - cameraSize;
        }
        // Compute camera delta
        cameraTarget.subEq(cameraPos); // final minus initial
        cameraPos.scaledAddEq(cameraTarget,dt*Settings.CAMERA_SPEED);
        // Step the rest of the simulation
        super.stepSimulation(dt,t);
    }
    updateLogic(t) {
        // Compute collisions
        collisions(
            this.colliders,
            this.newColliders,
            this.colliderBackBuffer,
        );
        const aux = this.colliders;
        this.colliders = this.colliderBackBuffer;
        this.colliderBackBuffer = aux;
        this.colliderBackBuffer.length = 0;
        // Mouse pos in world coordinates
        this.cursor.eqTransform(this.res.io.cursor,camera);
        this.cursor.addEq(cameraPos);
        // Camera
        camera.eq(res.io.aspectInv);
        camera.mulEq(cameraSize);
        cameraInv.eqInverse(camera);
        // Time
        time.eqFrom(t);
        // Spawn new figments
        if (this.figmentSpawnCountdown < 0 && this.nFigments < Settings.MAX_FIGMENTS) {
            this.figmentSpawnCountdown = Settings.FIGMENT_SPAWN_PERIOD*2*Math.random();
            // Pick a point on the screen
            const point = Vec2.Polar(cameraSize*1.4,Math.random()*2*Math.PI);
            point.addEq(cameraPos);
            // Get color
            this.field.read(point);
            const a = this.field.f.x;
            const b = a + this.field.f.y;
            const c = b + this.field.f.z;
            const index = Math.random()*c;
            let color = 'blue';
            if (index < a) {
                color = 'pink';
            } else if (index < b) {
                color = 'yellow';
            }
            // Spawn figment at point
            new Figment(
                res,
                sprites,
                brushes,
                this,
                point,
                color,
            );
        }
        // Spawn new dark figments
        if (this.darkFigmentSpawnCountdown < 0 && this.nDarkFigments < Settings.MAX_DARK_FIGMENTS) {
            this.darkFigmentSpawnCountdown = Settings.DARK_FIGMENT_SPAWN_PERIOD*2*Math.random();
            const point = cameraPos.clone();
            point.y += cameraSize * 1.4;
            point.x += (Math.random()*2-1) * cameraSize;
            // Spawn figment at point
            new Figment(
                res,
                sprites,
                brushes,
                this,
                point,
                'neutral',
            );
        }
        // Delete objects outside of range
        for (const sprite of this.sprites) {
            if (sprite.pos.distance2(cameraPos) > Settings.ENTITY_VANISH_RADIUS2) {
                sprite.destroy();
            }
        }
        super.updateLogic(t);
    }
    addCollider(collider) {
        this.newColliders.push(collider);
    }
}
const e = new DeeperEngine(res,render,env,[sprites,brushes]);
window.e = e;
e.start();
}).catch(
    (error) => {
        console.error(error);
        failed = true;
        const message = escapeMonospaceHtml(error.toString());
        document.getElementById('errordisplay').style.display = 'block';
        document.getElementById('clicktostart').style.display = 'none';
        document.getElementById('loader').style.display = 'none';
        document.getElementById('errordisplay-content').innerHTML = message;
    }
);
