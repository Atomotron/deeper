#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D source;

varying vec2 samplePoint;

void main() {
    gl_FragColor = texture2D(source, samplePoint);
}
