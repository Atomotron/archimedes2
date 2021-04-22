#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform float t;
uniform mat2 aspect;

attribute vec2 vertex;
attribute vec4 transform;
attribute vec2 translate;
attribute vec4 color;

varying vec2 uv;
varying vec4 vcolor;

const float LAMBDA = 0.1;

void main() {
    // Compute tangent matrix
    mat2 tangentMatrix = mat2(color - vec4(0.5));
    // Animate, and approximate brief flow
    mat2 flow = (mat2(1.0) + LAMBDA*cos(t)*tangentMatrix);
    // Repeated application of brief flow
    for (int i=0; i<4; i++) { // 4 -> A^(2^4) = A^16
        flow = flow*flow;
    }
    
    vcolor = color;
    uv = vertex * vec2(0.5,-0.5) + vec2(0.5);
    gl_Position = vec4(aspect * (mat2(transform)*flow*vertex + translate),0.0,1.0);
}
