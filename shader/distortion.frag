#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;


varying vec2 worldCoordinate;
varying vec2 uv;
varying float size;

const float DISTORTION_SCALE = 32.0/256.0;

vec4 encodeDistortion(vec2 distortion) {
    distortion /= 256.0;
    vec4 encoded = vec4(
         max(distortion.x, 0.0), // Positive 
        -min(distortion.x, 0.0), // Negative 
         max(distortion.y, 0.0), // Positive 
        -min(distortion.y, 0.0)  // Negative 
    );
    return encoded / DISTORTION_SCALE; 
}

float gd(float x) {
    return x*exp(-x*x);
}

const float DIS = -10.0;
void main() {
    float dsize = size;
    float clamper = -smoothstep(-1.0,-0.9,-length(uv));
    vec2 dis = vec2(gd(uv.x),gd(uv.y));
    dis *= 1.0/(dsize*dsize) * (-smoothstep(-10.0,-9.0,-dsize)) * smoothstep(1.0,1.1,dsize);
    gl_FragColor = encodeDistortion(clamper*DIS*dis);
}
