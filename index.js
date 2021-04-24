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
        },
        fragment:{
            blit: new URL("shader/blit.frag", document.baseURI),
        },
        programs: {
            sprite:['sprite','blit'],
        },
    },
    images: {
        test_level: new URL("image/test_level.png", document.baseURI),
    },
    imageSettings: {
        test_level: {
            
        }
    },
    sounds: {
    },
    streams: {
    },
    spritesheets: {},
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
// Disable click to start message / loading screen
document.getElementById('overlay').style.display = 'none';

window.res = res;
/*// Set up globals
const camera = Mat2.Id();
const cameraPos = Vec2.From(0.0,0.0);
const cameraInv = Mat2.Inverse(camera);

window.camera = camera;
window.cameraPos = cameraPos;
window.cameraInv = cameraInv;

// Sprites
const layer = new Geometry(
    res.gl,
    res.shaders.sprite.schema({
        vertex:{divisor:0,stream:false},
        pos   :{divisor:1,stream:true},
        model :{divisor:1,stream:true},
        frame :{divisor:1,stream:true},
    }),
    4, // 4 vertices
    10, // a lot of instances
);
console.log(layer.sch.toString());
layer.vert.acquire().vertex.eqFrom(-1.0,-1.0);
layer.vert.acquire().vertex.eqFrom( 1.0,-1.0);
layer.vert.acquire().vertex.eqFrom(-1.0, 1.0,);
layer.vert.acquire().vertex.eqFrom( 1.0, 1.0,);
layer.sync(res.gl);

// Make an instance
window.sprite = layer.inst.acquire();
window.sprite.pos.eqFrom(0.0,0.0);
window.sprite.model.eq(res.images.sprites.sheet.model['floor.png']);
window.sprite.frame.eq(res.images.sprites.sheet.frame['floor.png']);
layer.sync(res.gl);

// Set up render sequence
const sequence = [
    ClearPass,
    SUM(DrawPass,{
        name: "Draw Sprites",
        shader: res.shaders.sprite,
        uniforms: {cameraPos:cameraPos,cameraInv:camera},
        samplers: {spritesheet: res.images.sprites},
        draw: (gl) => {
            layer.draw(gl,gl.TRIANGLE_STRIP);
        },
    }),
];
const [render,env] = compileRenderer(sequence);

class SpriteEngine extends Engine {
    updateLogic(t) {
        camera.eq(res.io.aspect);
        camera.mulEq(1/256);
        cameraInv.eqInverse(camera);
    }
}
const e = new SpriteEngine(res,render,env);
window.e = e;
e.start();*/
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
