uniform vec3 lightPosition;
    
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main () {
  vec3 lightDirection = normalize(lightPosition - vWorldPosition);

  vec3 outgoingLight = vec3(1.0);

  vec4 shadowMask = vec4(1.0);
  
  // simpliest hardcoded lighting ^^
  float c = 0.35 + max(0.0, dot(vNormal, lightDirection)) * 0.4;
  vec4 lightColor = vec4(c, c, c, 1.0);

  gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0) * lightColor;
}
