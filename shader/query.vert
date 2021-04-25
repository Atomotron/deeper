#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

// The output location for the query
attribute vec2 outputPoint;
// The point in the texture to be sampled
attribute vec2 samplePoint;

// Passing the sample point along to the fragment shader
varying vec2 samplePointVert;

void main() {
    gl_Position = outputPoint;
    samplePointVert = samplePoint;
    gl_PointSize = 1.0;
}
