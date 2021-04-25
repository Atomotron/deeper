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
import {Sprites,AnimatedSprites,AnimatedSprite,TargetSprite} from './sprite.js';
import {collisions} from './collider.js';
import {Field,Brushes} from './field.js';

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

load({
    canvas:document.querySelector("canvas"),
    shaders: {
        vertex: {
            sprite: new URL("shader/sprite.vert", document.baseURI),
            background: new URL("shader/background.vert", document.baseURI),
            //query: new URL("shader/query.vert", document.baseURI),
        },
        fragment:{
            blit: new URL("shader/blit.frag", document.baseURI),
            colorblit: new URL("shader/colorblit.frag", document.baseURI),
        },
        programs: {
            sprite:['sprite','colorblit'],
            background:['background','blit'],
        },
    },
    images: {
        test_level: new URL("image/test_level_2.png", document.baseURI),
        sprites: new URL("image/texture.png", document.baseURI),
        brush: new URL("image/brush.png", document.baseURI),
    },
    imageSettings: {
        test_level: {
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
        }
    },
    sounds: {
    },
    streams: {
        ambience: new URL("sound/ambience.ogg", document.baseURI),
    },
    spritesheets: {
        sprites: new URL("image/texture.geom.json", document.baseURI),
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
const ambienceNode = res.io.adc.createMediaElementSource(res.streams.ambience);
ambienceNode.connect(res.io.mixer);
window.node = ambienceNode;
res.streams.ambience.play();

// CAMERA
const camera = Mat2.Id();
const cameraPos = Vec2.From(0,0);
let cameraSize = 512;
res.io.canvas.addEventListener('wheel',
    (e) => {
        cameraSize *= Math.exp(Math.sign(event.deltaY));
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
const bgModel = res.images.test_level.sheet.model.all.clone();
bgModel.mulEq(8);
const bgModelInv = bgModel.inverse();
const bgPos = Vec2.From(bgModel.a00,-bgModel.a11*2);
// TIME
const time = Vec1.From(0);

// SPRITE LAYER
const sprites = new AnimatedSprites(res);

// BRUSH LAYER
const brushes = new Brushes(res);

// PHYSICS FIELD
const field = new Field(res,res.images.test_level,bgModelInv,bgPos);

// Make an instance
/*
window.sprite = layer.inst.acquire();
window.sprite.pos.eqFrom(0.0,0.0);
window.sprite.model.eq(res.images.sprites.sheet.model['floor.png']);
window.sprite.frame.eq(res.images.sprites.sheet.frame['floor.png']);
layer.sync(res.gl);*/

// Set up render sequence

const sequence = [
    ClearPass,
    SUM(DrawPass,{
        name: "Draw Background",
        shader: res.shaders.background,
        uniforms: {
            cameraPos:cameraPos,
            camera:camera,
            bgModelInv:bgModelInv,
            bgPos:bgPos},
        samplers: {source: field.fb},
        draw: (gl) => bgLayer.draw(gl),
    }),
    SUM(DrawPass,{
        name: "Draw Sprites",
        shader: sprites.shader,
        uniforms: {
            cameraInv: cameraInv,
            cameraPos: cameraPos,   
        },
        samplers: {
            source: sprites.texture,
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
        // Collider setup
        this.colliders = [];
        this.newColliders = [];
        this.colliderBackBuffer = [];
        
        // Sprite creation
        this.sprite = new TargetSprite(
            sprites,
            this,
            field,
            'granny','move', // These replace spritename!
            Vec2.Zero(),
            1,
            0,
            1,
            true,
            false,
        );
        this.sprite.fieldSensitivity.z = 0.0;
        const names = Array.from(Object.keys(sprites.animations));
        this.res.io.canvas.addEventListener('mousedown', (e) => {
            this.sprite.folder = names.shift();
            names.push(this.sprite.folder);
        });
        window.s = this.sprite;
        this.sprite.struct.color.z = 0.0;
        
        for (let i=0; i<20; i++) {
            const s = new TargetSprite(
                sprites,
                this,
                field,
                (names)[Math.floor(Math.random()*names.length)],
                'move',
                Vec2.From(Math.random()-0.5,Math.random()-0.5).mulEq(2048),
                1,
                0, // angle
                1,
                false,
                true,
                Vec2.From(Math.random()-0.5,Math.random()-0.5).mulEq(512), // velocity
                1, //damping
                this.sprite.pos,
                1000, //target power
                Math.random() * Math.PI * 2, // target angle
            );
        }
        sprites.sync(res.gl);
    }
    stepSimulation(dt,t) {
        field.read(this.cursor);
        if (this.res.io.pressed.has('Mouse0')) {
            this.sprite.target.eq(this.cursor);
            this.sprite.targetPower = 3000;
        } else {
            this.sprite.target.eq(this.sprite.pos);
            this.sprite.targetPower = 0;
        }
        // Update camera pos
        cameraTarget.zeroEq();
        cameraTarget.addEq(this.sprite.target);
        cameraTarget.addEq(this.sprite.pos);
        cameraTarget.mulEq(Settings.CAMERA_SPEED);
        cameraTarget.subEq(cameraPos); // final minus initial
        
        cameraPos.scaledAddEq(cameraTarget,dt);
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
        super.updateLogic(t);
    }
    addCollider(collider) {
        this.newColliders.push(collider);
    }
}
const e = new DeeperEngine(res,render,env,[sprites]);
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
