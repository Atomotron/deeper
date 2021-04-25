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

import {Quad} from './quad.js';
import {Sprites,Sprite} from './sprite.js';
import {collisions} from './collider.js';

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
    },
    imageSettings: {
        test_level: {
            minFilter: 'LINEAR',
            magFilter: 'LINEAR',
            wrapS: 'REPEAT',
            wrapT: 'CLAMP_TO_EDGE',
            stretch: false,
        }
    },
    sounds: {
    },
    streams: {
    },
    spritesheets: {
        sprites: new URL("image/texture.geom.json", document.baseURI),
    },
    skipAudioWait: true,
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

// CAMERA
const camera = Mat2.Id();
const cameraPos = Vec2.From(0,0);
let cameraSize = 256;
const cameraInv = Mat2.Inverse(camera);
window.camera = camera;
window.cameraPos = cameraPos;
window.cameraInv = cameraInv;

// MOUSE
const cursor = Vec2.From(0.0,0.0);

// BACKGROUND
const bgLayer = new Quad(gl,
    res.shaders.background.schema({vertex:{divisor:0,stream:false}}),
    1,
);
const bgModel = res.images.test_level.sheet.model.all;
const bgModelInv = res.images.test_level.sheet.model.all.inverse();
const bgPos = Vec2.From(0,-bgModel.a11);
// TIME
const time = Vec1.From(0);

// SPRITE LAYER
const sprites = new Sprites(res);

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
        samplers: {source: res.images.test_level},
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
        this.sprite = new Sprite(
            sprites,this,'granny','move',true,false,
        );
        window.s = this.sprite;
        
        for (let i=0; i<2000; i++) {
            const s = new Sprite(
                sprites,this,(['balloon','croc','granny'])[Math.floor(Math.random()*3)],
            );
            s.pos.eqFrom(Math.random()-0.5,Math.random()-0.5);
            s.pos.mulEq(4096*2);
        }
        sprites.sync(res.gl);
    }
    stepSimulation(dt,t) {
        //cameraPos.x += CAM_VEL*dt;
        super.stepSimulation(dt,t);
        this.sprite.moveTo(this.cursor);
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
