attribute float scale;
attribute vec2 letterOffset;

varying vec2 v_letterOffset;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main () {
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(vec3(1.0, 1.0, scale) * position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;

  vNormal = normalMatrix * normal;
  v_letterOffset = letterOffset;
  vUv = uv;
  vWorldPosition = worldPosition.xyz;
}
