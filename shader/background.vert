#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

// Camera
uniform mat2 camera;
uniform vec2 cameraPos;

// BG image size and location
uniform vec2 bgPos;
uniform mat2 bgModelInv;

// Vertex attributes
attribute vec2 vertex;

// Texture coordinate
varying vec2 uv;

// Maps UV to sample from a box equal to the world coordinates.
void main() {
    // First, compute the location of this corner of the camera rect
    // in world coordinates.
    vec2 worldCoordinate = cameraPos + (camera * vertex);
    // Next, find out where that is in background texture coordinates.
    uv = bgModelInv * (worldCoordinate - bgPos);
    // Flip Y
    uv.y = 1.0-uv.y;
    gl_Position = vec4(vertex,0.5,1.0);
}
