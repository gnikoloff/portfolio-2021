import * as THREE from 'three'

import {
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  ENTRY_TYPE_SYMBOL_DOT,
  DECORATION_TYPE_BORDER,
} from '../constants'

import vertexShaderFront from './vertex-shader-front.glsl'
import fragmentShaderFront from './fragment-shader-front.glsl'

import vertexShaderSide from './vertex-shader-side.glsl'
import fragmentShaderSide from './fragment-shader-side.glsl'

export default class CubeView {
  constructor ({
    radius,
    lightPosition,
    textureManager,
    rotation = [0, 0, 0]
  }) {
    this._textureManager = textureManager
    this._radius = radius
    this._numBoxes = radius * radius

    this._geometry = new THREE.BoxBufferGeometry(1, 1, this._radius)
    this._geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, this._radius / 2))

    const scales = new Float32Array(this._numBoxes)
    const letterOffsets = new Float32Array(this._numBoxes * 2)
    for (let i = 0; i < this._numBoxes; i++) {
      scales[i] = 1
      // scales[i] = Math.random()
    }

    this._geometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1))
    this._geometry.setAttribute('letterOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))
    
    this._frontMaterial = new THREE.ShaderMaterial({
      uniforms: {
        lightPosition: { value: lightPosition },
        letterTexture: { value: this._textureManager.texture },
      },
      vertexShader: vertexShaderFront,
      fragmentShader: fragmentShaderFront,
    })

    this._sideMaterial = new THREE.ShaderMaterial({
      uniforms: {
        // lightPosition: { value: new THREE.Vector3(700, 700, 700) },
        lightPosition: { value: lightPosition },
      },
      vertexShader: vertexShaderSide,
      fragmentShader: fragmentShaderSide,
    })

    const materials = [
      this._sideMaterial,
      this._sideMaterial,
      this._sideMaterial,
      this._sideMaterial,
      this._frontMaterial,
      this._sideMaterial,
    ]

    this._mesh = new THREE.InstancedMesh(this._geometry, materials, this._numBoxes)
    this._mesh.rotation.set(...rotation)
    // this._mesh.position.set(0, 0, -this._radius / 2)

    const matrix = new THREE.Matrix4()
    for (let i = 0; i < this._numBoxes; i++) {
      const xIdx = i % this._radius
      const yIdx = (i - xIdx) / this._radius
      const x = xIdx - this._radius / 2
      const y = yIdx - this._radius / 2
      matrix.setPosition(x, y, 0)
      this._mesh.setMatrixAt(i, matrix)
    }
  }
  get mesh () {
    return this._mesh
  }
  
  drawScreen (screenData) {
    Object.entries(screenData).map(keyValue => {
      const key = keyValue[0]
      const { x, y, type } = keyValue[1]
      const startIdx = x + this._radius * (this._radius - y)
      if (type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
        for (let i = startIdx, n = 0; i < startIdx + key.length; i++) {
          const entry = {
            value: key[n], type
          }
          const texCoords = this._textureManager.getEntryTexCoordinate(entry)
          this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
          this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
          n++
        }
      } else if (type === ENTRY_TYPE_WORD_LINE) {
        const entry = {
          value: key, x, y, type
        }
        const texCoords = this._textureManager.getEntryTexCoordinate(entry)
        for (let i = startIdx, n = 0; i < startIdx + texCoords.length; i++) {
          this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[n][0]
          this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[n][1]
          n++
        }
      } else if (key === DECORATION_TYPE_BORDER) {
        const entry = { type }
        const texCoords = this._textureManager.getEntryTexCoordinate(entry)
        for (let i = 0; i < this._numBoxes; i++) {
          const xIdx = i % this._radius
          const yIdx = (i - xIdx) / this._radius
          if (xIdx === 0 || xIdx === this._radius - 1 || yIdx === 0 || yIdx === this._radius - 1) {
            this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
            this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
          }
        }
      }
    })
  }

  onUpdateFrame () {
    this._mesh.geometry.attributes.scale.needsUpdate = true
    this._mesh.geometry.attributes.letterOffset.needsUpdate = true
  }
}
