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
            sigmoid_stretch: new URL("shader/sigmoid_stretch.frag", document.baseURI),
        },
        programs: {
            sprite:['sprite','blit'],
            background:['background','blit'],
        },
    },
    images: {
        test_level: new URL("image/test_level.png", document.baseURI),
    },
    imageSettings: {
        test_level: {
            minFilter: 'LINEAR',
            magFilter: 'LINEAR',
            wrapS: 'WRAP',
            wrapT: 'CLAMP_TO_EDGE',
            stretch: true,
        }
    },
    sounds: {
    },
    streams: {
    },
    spritesheets: {},
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
// Set up globals
const camera = Mat2.Id();
const cameraPos = Vec2.From(0.5,0.5);
let cameraSize = 1;
const cameraInv = Mat2.Inverse(camera);

window.camera = camera;
window.cameraPos = cameraPos;
window.cameraInv = cameraInv;
console.log(res.shaders.background+'');
// Sprites
const bgLayer = new Quad(gl,
    res.shaders.background.schema({vertex:{divisor:0,stream:false}}),
    1,
);

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
        uniforms: {cameraPos:cameraPos,camera:camera},
        samplers: {source: res.images.test_level},
        draw: (gl) => bgLayer.draw(gl),
    }),
];
const [render,env] = compileRenderer(sequence);

class SpriteEngine extends Engine {
    updateLogic(t) {
        camera.eq(res.io.aspectInv);
        camera.mulEq(cameraSize);
        cameraInv.eqInverse(camera);
    }
}
const e = new SpriteEngine(res,render,env);
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
