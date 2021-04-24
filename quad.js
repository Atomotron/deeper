import {
    // Drawing stuff
    Geometry,
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

// The very common Geometry use-case of instances with
// a square "vertex"
export class Quad extends Geometry {
    constructor(gl,schema,instances=0) {
        super(gl,schema,4,instances);
        this.vert.acquire().vertex.eqFrom(-1.0,-1.0);
        this.vert.acquire().vertex.eqFrom( 1.0,-1.0);
        this.vert.acquire().vertex.eqFrom(-1.0, 1.0,);
        this.vert.acquire().vertex.eqFrom( 1.0, 1.0,);
        this.sync(gl);
    }
    draw(gl) {
        super.draw(gl,gl.TRIANGLE_STRIP);
    }
}
