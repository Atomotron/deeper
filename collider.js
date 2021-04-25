import {
    // Math
    Vec1,Vec2,Vec3,Vec4,
    Vec1I,Vec2I,Vec3I,Vec4I,
    Mat2,Mat3,Mat4,
} from './engine/archimedes.js';

let counter = 0;

export class Collider {
    NAME = 'collider'
    constructor(sends=false,receives=true) {
        this.sends = sends;
        this.receives = receives;
        this.removeFromColliders = false;
        this.translate = Vec2.From(0,0);
        this.transform = Mat2.Id();
        
        this.ccAccs = [Vec2.From(0,0)];
        this.ccRadii2 = [0];
        this.nCcAccs = 1;
        
        this.ccTop = 0;
        this.ccBottom = 0;
    }
    getColliders() {
        return [];
    }
    updateCcAcc() {
        const controlPoints = this.getColliders();
        // Set accumulator list length
        this.nCcAccs = controlPoints.length;
        while (this.ccAccs.length < this.nCcAccs) {
            this.ccAccs.push(Vec2.From(0,0));
            this.ccRadii2.push(0);
        }
        // Update accumulators
        for (let i=0; i<this.nCcAccs; i++) {
            const ccAcc = this.ccAccs[i];
            const controlPoint = controlPoints[i];
            this.ccRadii2[i] = controlPoint.r * controlPoint.r
                               * Math.abs(this.transform.determinant());
            ccAcc.eqTransform(controlPoint.pos,this.transform);
            ccAcc.addEq(this.translate);
            // Update top and bottom
            const r = Math.sqrt(this.ccRadii2[i]);
            const top = ccAcc.y + r;
            const bottom = ccAcc.y - r;
            if (i === 0 || top > this.ccTop) {
                this.ccTop = top;
            }
            if (i === 0 || bottom < this.ccBottom) {
                this.ccBottom = bottom;
            }
        }
    }
    checkCollision(other) {
        for (let i=0; i<this.nCcAccs; i++) {
            const ourR2  = this.ccRadii2[i];
            const ourPos = this.ccAccs[i];
            for (let j=0; j<other.nCcAccs; j++) {
                const theirR2  = other.ccRadii2[j];
                const theirPos = other.ccAccs[j];
                // Compute radius and check collision
                const r2 = theirPos.distance2(ourPos);
                if (r2 <= theirR2 + ourR2) {
                    return true;
                }
            }
        }
        return false;
    }
    // Called to inform this collider that it has collided
    collide(other) {
        console.log(`${this.NAME} contacts ${other.NAME}`);
    }
}

function compareBottoms(a,b) {
    return a.ccBottom - b.ccBottom;
}

function sortArray(a) {
    a.sort(compareBottoms)
}

export function collisions(colliders,newColliders=[],remainingColliders=[]) {
    counter += 1;
    // Add in the new colliders
    for (let i=0; i<newColliders.length; i++) {
        colliders.push(newColliders[i]);
    }
    newColliders.length = 0;
    // Update colliders
    for (let i=0; i<colliders.length; i++) {
        const collider = colliders[i];
        if (collider.removeFromColliders) {
            continue;
        } else {
            remainingColliders.push(collider);
            collider.updateCcAcc();
        }
    }
    // Sort the colliders
    sortArray(remainingColliders);
    // Scan colliders from lowest to highest
    let interestingColliders = []; // The colliders that matter
    let stillInterestingColliders = [];
    for (let i=0; i<remainingColliders.length; i++) {
        const collider = remainingColliders[i];
        const sweepPoint = collider.ccBottom;
        if (collider.receives) {
            // Check every interesting collider against this one
            for (let j=0; j<interestingColliders.length; j++) {
                const otherCollider = interestingColliders[j];
                // Check to see if this collider is still potentially relevant.
                if (otherCollider.ccTop < sweepPoint) {
                    // We'll never see another collider that overlaps with otherCollider,
                    // because they're sorted by bottoms, and this bottom is already too high.
                } else {
                    stillInterestingColliders.push(otherCollider);
                    // Check for collision
                    if (otherCollider.checkCollision(collider)) {
                        otherCollider.collide(collider);
                        collider.collide(otherCollider);
                    }
                }
            }
            //if (counter % 60 === 0) console.log(i,stillInterestingColliders.length,sweepPoint);
            // Swap stacks
            const aux = interestingColliders;
            interestingColliders = stillInterestingColliders;
            stillInterestingColliders = aux;
            stillInterestingColliders.length = 0; // Clear for next iteration
        }
        if (collider.sends) {
            interestingColliders.push(collider);
        }
    }
}
