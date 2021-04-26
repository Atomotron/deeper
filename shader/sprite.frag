#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D source;
uniform sampler2D noise;

uniform float time;

varying vec2 uv;
varying vec4 vertexColor;
varying vec2 vertexTail;


void main() {
    // Base sample
    vec4 tex = texture2D(source, uv);
    float solid = tex.x;
    float glow = tex.y;
    float alpha = tex.w * vertexColor.w;
    vec3 glowColor = vec3(glow) * vertexColor.xyz;
    vec3 solidColor = vec3(solid);
    vec4 baseColor = vec4(glowColor+solidColor,alpha);
    // Distorted sample
    vec4 noiseSample = texture2D(noise, uv*10.0 + vec2(0.0,time*0.1));
    vec2 distortion = noiseSample.xy * 0.01;
    vec4 distortedSample = texture2D(source, uv + distortion);
    vec3 distortedGlow = vec3(distortedSample.y) * vertexColor.xyz;
    float distortedAlpha = distortedSample.w;
    vec4 distortedColor = vec4(distortedGlow,distortedAlpha);
    gl_FragColor = baseColor + distortedColor;
}
