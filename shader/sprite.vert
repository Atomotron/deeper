#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

// Camera
uniform mat2 cameraInv;
uniform vec2 cameraPos;

// Vertex attributes
attribute vec2 vertex;

// Instance attributes
attribute vec2 pos;
attribute vec4 model;
attribute vec4 frame;
attribute vec4 color;

// Texture coordinate
varying vec2 uv;
varying vec2 vertexTail;
varying vec4 vertexColor;

void main() {
    vertexColor = color;
    uv = (frame.xy + (vertex * frame.zw));
    vec2 world_coordinate = mat2(model) * vertex + pos;
    gl_Position = vec4(cameraInv*(world_coordinate-cameraPos),0.5,1.0);
}
