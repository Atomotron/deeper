// Spritesheet implementation
import {Vec2,Mat2,Vec4} from './linearalgebra.js';

class ControlPoint {
    constructor(pos,r) {
        this.pos = pos;
        this.r = r;
    }
}

// Returns a Vec4 containing the uv offset in its first two components
// and the uv scalar (width/2,height/2) in the second two components.
/*
In the shader, you'd write something like this:
  uv = frame.xy + (frame.wz * vertex);
  to translate the [-1,1] x [-1,1] unit square geometry
  into uv coordinates for texture lookup.
*/
function makeFrame(texture,sprite,meta) {
    // First, make the frame vector in image pixel coordinates.
    const frame = Vec4.From(
        sprite.x + sprite.w/2, // Center X
        sprite.y + sprite.h/2, // Center Y
        sprite.w/2,
        sprite.h/2,
    );
    // Next, convert to whole-image relative uv coordinates
    const width = meta.size.w, height=meta.size.h;
    frame.x /= width;   // x=width  -> x' = 1
    frame.y /= height;  // y=height -> y' = 1
    frame.z /= width;   // w/2=width/2 -> w/2' = 1
    frame.w /= height;  // h/2=width/2 -> h/2' = 1
    // Finally, convert to the actual uvs used in the shader.
    frame.x *= texture.maxU; // x=1 -> x=maxU
    frame.y *= texture.maxV; // y=1 -> y=maxV
    frame.z *= texture.maxU; // w/2=1/2 -> w= maxU/2
    frame.w *= texture.maxV; // h/2=1/2 -> h=-maxV/2
    frame.w *= -1; // Texture coordinates are upside down
    // We now have a conversion from [-1,1] x [-1,1] to the frame in texture C.
    return frame;
}

// Returns a Mat2 that maps the [-1,1]x[-1,1] standard square to a
// [-width/2,width/2]x[-height/2,height/2] centered rectangle.
function makeModel(sprite) {
    const model = Mat2.Id();
    model.a00 = sprite.w / 2; // x=-1 should become -w/2
    model.a11 = sprite.h / 2; // y=-1 should become -h/2
    return model;
}

export class Spritesheet {
    // A texture is needed because it's not until the texture is created
    // that we can find out how much of the texture rectangle was occupied
    // by image data. That's because gl max texture is involved.
    constructor(texture,sheetJson=null) {
        this.frame = {};  // Sprite frame rects
        this.model = {};  // Sprite model matrices
        this.control = {}; // control points
        this.collision = {}; // collision circles
        // Default sheet: one frame, 'all', that contains the texture.
        if (sheetJson === null) {
            sheetJson = {
                frames:{
                    all: {
                        frame: {
                            x: 0,
                            y: 0,
                            w:texture.sourceWidth,
                            h:texture.sourceHeight,
                        },
                    },
                },
                meta:{
                    size:{
                        w:texture.sourceWidth,
                        h:texture.sourceHeight,
                    },
                },
            };
        }
        // Create frames, models and control points
        const meta = sheetJson.meta;
        for (const name in sheetJson.frames) {
            const spriteData = sheetJson.frames[name];
            this.frame[name] = makeFrame(texture,spriteData.frame,meta);
            this.model[name] = makeModel(spriteData.frame);
            if (spriteData.circles) {
                for (const cname in spriteData.circles) {
                    // Convert circle pos to center-relative.
                    const circle = spriteData.circles[cname];
                    const frameCenterX = spriteData.spriteSourceSize.x + spriteData.spriteSourceSize.w/2;
                    const frameCenterY = spriteData.spriteSourceSize.y + spriteData.spriteSourceSize.h/2;
                    const cx = circle.cx-frameCenterX;
                    const cy = frameCenterY-circle.cy;
                    const controlPoint = new ControlPoint(
                        Vec2.From(cx,cy),   // pos
                        circle.r,           // r
                    );
                    if (cname.startsWith("Collision")) {
                        if (!this.collision[name]) this.collision[name] = [];
                        this.collision[name].push(controlPoint);
                    } else {
                        if (!this.control[name]) this.control[name] = {};
                        this.control[name][cname] = controlPoint;
                    }
                    
                }
            }
            if (!this.control[name]) this.control[name] = {
                'CoM': {pos:Vec2.Zero(), r: 1},
            }; // Empty control point set
            if (!this.collision[name]) {
                this.collision[name] = [this.control[name].CoM];
            } // Empty collision points
            // Sort collision points from lowest bottom to highest bottom.
            function bottomDifference(a,b) {
                (a.pos.y-a.r) - (b.pos.y-b.r)
            }
            this.collision[name].sort(bottomDifference);
        }
    }
}
