#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D source;

varying vec2 uv;
varying vec4 vertexColor;

void main() {
    gl_FragColor = texture2D(source, uv)*vertexColor;
}
