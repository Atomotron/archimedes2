#version 100
#extension GL_OES_standard_derivatives : enable
precision highp float;

attribute vec2 vertex;
attribute vec4 transform;
attribute vec2 translate;
attribute vec4 color;

varying vec4 vcolor;

void main() {
    vcolor = color;
    gl_Position = vec4(mat2(transform)*vertex + translate,0.0,1.0);
}
