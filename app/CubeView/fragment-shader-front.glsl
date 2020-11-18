uniform sampler2D letterTexture;
uniform vec3 lightPosition;

varying vec2 v_letterOffset;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main () {
  vec3 lightDirection = normalize(lightPosition - vWorldPosition);
  
  // simpliest hardcoded lighting ^^
  float c = 0.35 + max(0.0, dot(vNormal, lightDirection)) * 0.4;

  vec4 lightColor = vec4(c, c, c, 1.0);
  vec4 baseColor = vec4(0.5, 0.5, 0.5, 1.0);
  vec4 texColor = texture2D(letterTexture, vUv * vec2(1.0 / 10.0, 1.0 / 10.0) + v_letterOffset);

  gl_FragColor = mix(baseColor, texColor, texColor.a) * lightColor;
}