#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

// Camera
uniform mat2 cameraInv;
uniform vec2 cameraPos;
uniform mat4 displayColorMatrix;
uniform float spriteModelPadding;

// Vertex attributes
attribute vec2 vertex;

// Instance attributes
attribute vec2 pos;
attribute vec4 model;
attribute vec4 frame;
attribute vec4 color;

// Texture coordinate
varying vec2 uv;
varying vec2 lowerUV;
varying vec2 upperUV;
varying vec2 locationInRect;
varying vec4 vertexChannel;
varying vec4 vertexDisplayColor;

void main() {
    vec2 paddingVertex = vertex*spriteModelPadding;
    vertexChannel = color;
    vec4 displayColor = displayColorMatrix * color;
    vertexDisplayColor = vec4(displayColor.xyz*displayColor.w,displayColor.w); // Premultiply
    uv = (frame.xy + (paddingVertex * frame.zw));
    lowerUV = frame.xy + vec2(-1.0, 1.0)*frame.zw;
    upperUV = frame.xy + vec2(1.0, -1.0)*frame.zw;
    vec2 world_coordinate = mat2(model) * vertex + pos;
    locationInRect = world_coordinate;
    gl_Position = vec4(cameraInv*(world_coordinate-cameraPos),0.5,1.0);
}
