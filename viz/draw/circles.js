const mat4 = require('gl-mat4')

module.exports = function (regl) {
  return regl({
    vert: `
    precision mediump float;
    attribute vec2 position;
    attribute float size;
    uniform vec3 color;
    uniform float distance;
    uniform mat4 projection, view;
    varying vec3 fragColor;
    void main() {
      gl_PointSize = size * 12.0 / pow(distance, 2.5);
      gl_Position = projection * view * vec4(position.x, -position.y, 0, 1);
      fragColor = vec3(1.0, 0.0, 0.0);
    }`,

    frag: `
    precision lowp float;
    varying vec3 fragColor;
    void main() {
      if ((length(gl_PointCoord.xy - 0.5) < 0.35) || (length(gl_PointCoord.xy - 0.5) > 0.5)) {
        discard;
      }
      gl_FragColor = vec4(fragColor, 1);
    }`,

    attributes: {
      position: regl.prop('positions'),
      size: regl.prop('sizes')
    },

    uniforms: {
      color: regl.prop('color'),
      distance: regl.prop('distance'),
      view: regl.prop('view'),
      projection: (context, props) =>
        mat4.perspective([],
          Math.PI / 2,
          context.viewportWidth * props.scale / context.viewportHeight,
          0.01, 1000),
    },

    count: regl.prop('count'),

    primitive: 'points'
  })
}