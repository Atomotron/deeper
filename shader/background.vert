#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

// Camera
uniform mat2 camera;
uniform vec2 cameraPos;

// Vertex attributes
attribute vec2 vertex;

// Texture coordinate
varying vec2 uv;

// Maps UV to sample from a box equal to the world coordinates.
void main() {
    uv = cameraPos + (camera * vertex);
    gl_Position = vec4(vertex,0.5,1.0);
}
