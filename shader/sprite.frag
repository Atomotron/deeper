#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D source;
uniform sampler2D noise;

uniform float time;

varying vec2 uv;
varying vec2 lowerUV;
varying vec2 upperUV;

varying vec4 vertexChannel;
varying vec4 vertexDisplayColor;
varying vec2 locationInRect;

const vec2 DISTORTION = vec2(0.1,1.0)*0.02;
const float DISTORTION_SPEED = 0.05;

const float DISTORTION_SCALE = 0.01;

vec4 clampedTexture2D(sampler2D sam, vec2 where) {
    return texture2D(sam, clamp(where,lowerUV,upperUV));
}

void main() {
    // Configure distortion
    // Base sample
    vec4 tex = clampedTexture2D(source, uv);
    float solid = tex.x;
    float glow = tex.y;
    float baseAlpha = tex.w * vertexDisplayColor.w;
    vec3 glowColor = vec3(glow) * vertexDisplayColor.xyz;
    vec3 solidColor = vec3(solid) * (1.0-vertexChannel.w);
    vec4 baseColor = vec4(glowColor*(1.0-solid)+solidColor,baseAlpha);
    // Distorted sample
    float noiseSample = dot(texture2D(noise, DISTORTION_SCALE*locationInRect + vec2(0.0,time*DISTORTION_SPEED)), vertexChannel) - 0.5;
    vec2 distortion = DISTORTION*noiseSample;
    vec4 distortedSample = clampedTexture2D(source, uv + distortion);
    vec3 distortedGlow = vec3(distortedSample.y) * vertexDisplayColor.xyz;
    float distortedAlpha = distortedSample.w * (
        max(max(max(vertexChannel.x,vertexChannel.y),vertexChannel.z),vertexChannel.w)
    );
    vec4 distortedColor = vec4(distortedGlow,distortedAlpha);
    gl_FragColor = baseColor + distortedColor*(1.0-baseAlpha);
}
