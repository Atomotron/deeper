#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform mat2 aspectInv;

// Vertex attributes
attribute vec2 vertex;

// Texture coordinate
varying vec2 uv;

void main() {
    uv = vertex*vec2(0.5,0.5) + vec2(0.5,0.5);
    gl_Position = vec4(vertex,0.5,1.0);
}
