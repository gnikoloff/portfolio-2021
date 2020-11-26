import * as THREE from 'three'

import {
  VIEW_HOME
} from './constants'

import screens from './screens.json'

export const loadImage = ({ src }) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Failed loading image with src ${src}`))
  image.src = src
})

export const extractViewFromURL = ({ pathname = window.location.pathname } = {}) => {
  let viewName
  if (pathname === '/') {
    viewName = VIEW_HOME
  } else if (pathname.includes('/works/') || pathname.includes('/info/')) {
    viewName = Object.entries(screens).find(([ key, value ]) => value.url == pathname)[0]
  } else {
    viewName = pathname.substring(1).toUpperCase()
  }
  return viewName
}

export const createShaderMaterial = ({
  uniforms,
  vertexShaderSnippets,
  fragmentShaderSnippets,
  metalness = 0.8,
  roughness = 0.7,
  bumpScale = 0.02
} = {}) => {

  const material = new THREE.MeshStandardMaterial({
    metalness,
    roughness,
    bumpScale
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
