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
varying vec2 worldCoordinate;
varying vec2 uv;

void main() {
    uv = (frame.xy + (vertex * frame.zw));
    worldCoordinate = mat2(model) * vertex;
    gl_Position = vec4(cameraInv*(worldCoordinate + pos-cameraPos),0.5,1.0);
    gl_Position += 0.0000001*frame + 0.0000001*color;
}
