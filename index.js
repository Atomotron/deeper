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

load({
    canvas:document.querySelector("canvas"),
    shaders: {
        vertex: {
            //sprite: new URL("sprite.vert", document.baseURI),
        },
        fragment:{
            //sprite:new URL("sprite.frag", document.baseURI),
        },
        programs: {}//sprite:['sprite','sprite']},
    },
    images: {
        //sprites: new URL("texture.png", document.baseURI),
    },
    imageSettings: {
    
    },
    sounds: {
    },
    streams: {
    },
    spritesheets: {},
    skipAudioWait: true,
}).then( (res) => {
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
});
