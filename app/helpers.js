import * as THREE from 'three'

export const loadImage = ({ src }) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Failed loading image with src ${src}`))
  image.src = src
})

export const createShaderMaterial = ({
  uniforms,
  vertexShaderSnippets,
  fragmentShaderSnippets
} = {}) => {

  const material = new THREE.MeshStandardMaterial({
    metalness: 0.8,
    roughness: 0.7,
    bumpScale: 0.02
  })

  material.onBeforeCompile = shader => {
    shader.uniforms = {
      ...uniforms,
      ...shader.uniforms
    }

    if (vertexShaderSnippets) {
      Object.entries(vertexShaderSnippets).forEach(([key, val]) => {
        shader.vertexShader = shader.vertexShader.replace(key, val)
      })
    }
  
    if (fragmentShaderSnippets) {
      Object.entries(fragmentShaderSnippets).forEach(([key, val]) => {
        shader.fragmentShader = shader.fragmentShader.replace(key, val)
      })
    }
  }

  return material
}
