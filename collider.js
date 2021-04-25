import {
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

export class Collider {
    constructor() {
        this.translate = Vec2.From(0,0);
        this.transform = Mat2.Id();
    }
    get colliders() {
        return [];
    }
}

export function collisions(colliders) {

}
