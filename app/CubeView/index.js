import * as THREE from 'three'

import TextureManager from '../TextureManager'
import eventEmitter from '../event-emitter'
import store from '../store'

import {
  setEntryHover,
} from '../store/actions'

import {
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  ENTRY_TYPE_SYMBOL_DOT,
  DECORATION_TYPE_BORDER,
  EVT_HOVER_MENU_ITEM,
} from '../constants'

import vertexShaderFront from './vertex-shader-front.glsl'
import fragmentShaderFront from './fragment-shader-front.glsl'

import vertexShaderSide from './vertex-shader-side.glsl'
import fragmentShaderSide from './fragment-shader-side.glsl'

const HOVERED_SCALE = 1.1

export default class CubeView {
  constructor ({
    radius,
    lightPosition,
    rotation = [0, 0, 0]
  }) {
    this._textureManager = TextureManager.getInstance()
    this._radius = radius
    this._numBoxes = radius * radius
    this._interactable = false

    this._screenData = null

    this._geometry = new THREE.BoxBufferGeometry(1, 1, this._radius)
    // this._geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, 0, this._radius / 2))

    const scales = new Float32Array(this._numBoxes)
    const letterOffsets = new Float32Array(this._numBoxes * 2)
    for (let i = 0; i < this._numBoxes; i++) {
      scales[i] = 1
      // scales[i] = Math.random()
    }

    this._geometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1))
    this._geometry.setAttribute('letterOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))

    const atlasTextureSize = new THREE.Vector2(this._textureManager.entriesPerRow, this._textureManager.entriesPerRow)
    
    this._frontMaterial = new THREE.ShaderMaterial({
      uniforms: {
        lightPosition: { value: lightPosition },
        letterTexture: { value: this._textureManager.texture },
        atlasTextureSize: { value: atlasTextureSize },
      },
      vertexShader: vertexShaderFront,
      fragmentShader: fragmentShaderFront,
    })

    this._sideMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([{
        lightPosition: {
          value: lightPosition
        },
        lightPosition: { value: lightPosition },
        atlasTextureSize: { value: atlasTextureSize },
      }]),
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
    this._mesh.castShadow = true
    this._mesh.receiveShadow = true
    this._mesh.visible = false
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
    this._mesh.customDepthMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float scale;
        void main () {
            vec4 worldPosition = modelMatrix * instanceMatrix * vec4(vec3(1.0, 1.0, scale) * position, 1.0);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: THREE.ShaderLib.shadow.fragmentShader,
    })
  }
  get mesh () {
    return this._mesh
  }

  set visible (visible) {
    if (!visible) {
      const texCoords = this._textureManager.getEntryTexCoordinate(' ')
      for (let i = 0; i < this._numBoxes; i++) {
        this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
        this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
      }
    }
    this._mesh.visible = visible
  }

  set interactable (interactable) {
    if (!interactable) {
      for (let i = 0; i < this._numBoxes; i++) {
        this._mesh.geometry.attributes.scale.array[i] = 1
      }
    }
    this._interactable = interactable
  }

  addToRotation (rotation) {
    this._mesh.rotation.x += rotation[0]
    this._mesh.rotation.y += rotation[1]
    this._mesh.rotation.z += rotation[2]
  }

  get rotation () {
    return this._mesh.rotation
  }

  clearScreen () {
    this._screenData = null
  }
  
  drawScreen (screenData) {
    if (!screenData) {
      throw new Error('Provided no view screenData')
      return
    }
    console.log(screenData)
    this._screenData = screenData
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
          } else if (i > 20 && i < 120) {
            this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
            this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
          }
        }
      } else {
        const texCoords = this._textureManager.getEntryTexCoordinate(' ')
        for (let i = 0; i < this._numBoxes; i++) {
          this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
          this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
        }
      }
    })
  }

  onUpdateFrame ({
    raycaster,
    mouse,
    camera
  }) {
    raycaster.setFromCamera(mouse, camera)

    const intersection = raycaster.intersectObject(this._mesh)

    let instanceId

    if (intersection.length > 0 && this._interactable) {
      instanceId = intersection[0] && intersection[0].instanceId
      const instanceXIdx = instanceId % this._radius
      const instanceYIdx = this._radius - (instanceId - instanceXIdx) / this._radius


      let hoveredItem

      if (this._screenData) {

        
        Object.entries(this._screenData).forEach(keyValue => {
          const key = keyValue[0]
          const { x, y, type, linksTo, isHoverable = false } = keyValue[1]


          if (key === DECORATION_TYPE_BORDER) {
            return
          }

          if (!isHoverable) {
            return
          }

          if (type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
            if (instanceXIdx >= x && instanceXIdx < x + key.length && instanceYIdx === y) {
              const startIdx = x + this._radius * (this._radius - y)
              for (let n = startIdx; n < startIdx + key.length; n++) {
                this._mesh.geometry.attributes.scale.array[n] = HOVERED_SCALE
              }
              hoveredItem = { key, linksTo }
            }
          } else if (type === ENTRY_TYPE_WORD_LINE) {
            const entry = {
              value: key, x, y, type
            }
            const startIdx = x + this._radius * (this._radius - y)
            const texCoords = this._textureManager.getEntryTexCoordinate(entry)
            if (instanceXIdx >= x && instanceXIdx < x + texCoords.length && instanceYIdx === y) {
              for (let i = startIdx; i < startIdx + texCoords.length; i++) {
                this._mesh.geometry.attributes.scale.array[i] = HOVERED_SCALE
              }
              hoveredItem = { key, linksTo }
            }
          }        
        })

        // if (hoveredItem) {
        //   if (!document.body.classList.contains('hovering')) {
        //     document.body.classList.add('hovering')
        //   }
        // } else {
        //   if (document.body.classList.contains('hovering')) {
        //     document.body.classList.remove('hovering')
        //   }
        //   store.dispatch(setEntryHover(null))
        //   for (let i = 0; i < this._numBoxes; i++) {
        //     // this._mesh.geometry.attributes.scale.array[i] = 1
        //   }
        // }
      }
      // console.log(hoveredItem, oldHoveredItem)

      // console.log(hoveredItem)
      
      if (this._interactable) {
        store.dispatch(setEntryHover(hoveredItem))
      }

      if (hoveredItem) {
          if (!document.body.classList.contains('hovering')) {
            document.body.classList.add('hovering')
          }
      } else {
        if (document.body.classList.contains('hovering')) {
          document.body.classList.remove('hovering')
        }
        for (let i = 0; i < this._numBoxes; i++) {
          this._mesh.geometry.attributes.scale.array[i] = 1
        }
      }

      
      
    } else {
      if (this._interactable) {
        store.dispatch(setEntryHover(null))
      }
    }

    this._mesh.geometry.attributes.scale.needsUpdate = true
    this._mesh.geometry.attributes.letterOffset.needsUpdate = true
  }
}
