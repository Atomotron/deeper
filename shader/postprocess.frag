#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D source;
uniform sampler2D distortion;

// Fade in/out point
uniform float screenFade;
// Converts world coordinates to screenspace coordinates
uniform mat2 cameraInv;

varying vec2 uv;

const float DISTORTION_SCALE = 32.0/256.0;
vec2 distortionAt(sampler2D disTex, vec2 uv) {
    vec4 distortionSample = texture2D(disTex,uv);
    distortionSample *= 256.0; // [0,255]
    vec2 raw = vec2(distortionSample.x-distortionSample.y,
                    distortionSample.z-distortionSample.w);
    vec2 uvd = (cameraInv * raw) * DISTORTION_SCALE;
    return uvd;
}

void main() {
    vec2 dis = distortionAt(distortion, uv);
    gl_FragColor = texture2D(source, uv+dis)*screenFade;
}
