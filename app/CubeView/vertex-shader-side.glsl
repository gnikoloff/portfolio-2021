attribute float scale;

varying vec3 vNormal;
varying vec3 vWorldPosition;
// varying vec2 vUv;
void main () {
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(vec3(1.0, 1.0, scale) * position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;

  vNormal = normalMatrix * normal;

  vWorldPosition = worldPosition.xyz;
  // vUv = uv;
}