import {Vec2,Mat2} from './linearalgebra.js';
// The IO class manages:
// - Mouse input
// - Keyboard input
// - Checking canvas DOM element size
// - Master volume
// - Audio context

/*

## Mouse buttons
You can check to see which mouse button is pressed by reading from io.pressed:
- `io.pressed.has("Mouse1"); // Check for left click`
- `io.pressed.has("Mouse2"); // Check for middle click`
- `io.pressed.has("Mouse3"); // Check for right click`

## Coordinates
`io.aspect` is a matrix that transforms from "largest contained square"
coordinates to OpenGL viewport coordinates.

`io.cursor` is in "largest contained square" coordinates.

`io.width` and `io.height` are the canvas size.

## Audio
`io.adc` is a resumed audio context. `io.mixer` is a master gain node.
You can set the master volume with `io.mixer.gain.value = ...`.
*/

export class IO {
    constructor(canvas,audioContext) {
        this.canvas = canvas;
        this.adc = audioContext;
        // Pressed button sets
        this.pressed = new Set(); // The set of pressed keys.
        // Add button event listeners.
        // Note that down-events are on the canvas, but up-events are on the window.
        canvas.addEventListener('keydown', 
            (e) => this.pressed.add(e.code)
        );
        window.addEventListener('keyup', 
            (e) => this.pressed.delete(e.code)
        );
        canvas.addEventListener('mousedown', 
            (e) => this.pressed.add(`Mouse${e.button}`)
        );
        window.addEventListener('mouseup', 
            (e) => this.pressed.delete(`Mouse${e.button}`)
        );
        // Size tracking
        this.onResize = new Set(); // functions to run when resizing
        this.width = 0;
        this.height = 0;
        this.aspect = Mat2.Id();
        this.aspectInv = Mat2.Id();
        // Mouse pos and inside-canvas status
        this.cursorX = 0;
        this.cursorY = 0;
        this.cursor = Vec2.From(0.0,0.0);
        this.focused = false;
        canvas.addEventListener('mousemove',
            (e) => {
                this.cursorX = e.offsetX;
                this.cursorY = e.offsetY;
                this.focused = true;
        });
        canvas.addEventListener('mouseenter',
            (e) => {this.focused = true}
        );
        canvas.addEventListener('mouseleave',
            (e) => {this.focused = false}
        );
        // Update to initial values based on canvas element size
        this.refresh();
        // Master volume mixer
        this.mixer = audioContext.createGain();
        this.mixer.connect(audioContext.destination);
    }
    // Run this every frame before any data is read to update values
    // that depend on canvas size.
    refresh() {
        // Update canvas size
        const width=this.canvas.clientWidth, height=this.canvas.clientHeight;
        if (width !== this.width || height !== this.height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        this.width = width;
        this.height = height;
        // Compute aspect ratio
        let scaleX = 1.0, scaleY = 1.0;
        if (width > height) scaleX = height/width;
        else                          scaleY = width/height;
        this.aspect.a00 = scaleX;
        this.aspect.a11 = scaleY;
        this.aspectInv.a00 = 1.0/scaleX;
        this.aspectInv.a11 = 1.0/scaleY;
        // Update cursor coordinates
        const cursorGlX = 2.0*this.cursorX/width - 1.0;
        const cursorGlY = 1.0 - 2.0*this.cursorY/height;
        this.cursor.eqFrom(cursorGlX, cursorGlY);
        // Run resize triggers
        for (const callback of this.onResize) {
            callback(this);
        }
    }
}
