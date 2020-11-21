import * as THREE from 'three'

import TextureManager from '../TextureManager'
import eventEmitter from '../event-emitter'
import store from '../store'

import {
  setEntryHover,
} from '../store/actions'

import {
  ENTRY_TYPE_IMAGE,
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  ENTRY_TYPE_SYMBOL_DOT,
  DECORATION_TYPE_BORDER,
  EVT_HOVER_MENU_ITEM,
} from '../constants'

import { Object3D } from 'three'

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

    this._matrix = new THREE.Matrix4()
    this._boxPosition = new THREE.Vector3()
    this._boxRotation = new THREE.Quaternion()
    this._boxScale = new THREE.Vector3()
    this._dummy = new Object3D()

    this._screenData = null

    this._geometry = new THREE.BoxBufferGeometry(1, 1, this._radius)
    // this._geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, 0, this._radius / 2))

    const letterOffsets = new Float32Array(this._numBoxes * 2)
    const textureIndices = new Float32Array(this._numBoxes)

    this._geometry.setAttribute('letterOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))
    this._geometry.setAttribute('textureIdx', new THREE.InstancedBufferAttribute(textureIndices, 1))

    const letterTextureData = this._textureManager.getTexture('characters')
    const imageTextureData = this._textureManager.getTexture('/assets/biest.png')

    const atlasTextureSize = new THREE.Vector2(letterTextureData.entriesPerRow, letterTextureData.entriesPerRow)

    var wVertex = THREE.ShaderLib["lambert"].vertexShader
    var wFragment = THREE.ShaderLib["lambert"].fragmentShader
    var wUniforms = THREE.ShaderLib["lambert"].uniforms

    this._frontMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        wUniforms,
        {
          letterTexture: { value: letterTextureData.texture },
          atlasTextureSize: { value: atlasTextureSize },
          imageTexture: { value: imageTextureData.value }
        }
      ]),
      lights: true,
      vertexShader: wVertex,
      fragmentShader: wFragment,
      depthPacking: THREE.RGBADepthPacking,
    })
    this._frontMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('varying vec3 vLightFront;', `
        attribute vec2 letterOffset;
        attribute float textureIdx;
        varying vec2 vUv;
        varying vec3 vLightFront;
        varying vec2 vLetterOffset;
        varying float vTextureIdx;
      `)
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
        vUv = uv;
        vLetterOffset = letterOffset;
        vTextureIdx = textureIdx;
      `)
      shader.fragmentShader = shader.fragmentShader.replace('uniform vec3 diffuse;', `
        uniform vec3 diffuse;
        uniform sampler2D letterTexture;
        uniform sampler2D imageTexture;
        uniform vec2 atlasTextureSize;
        varying vec2 vLetterOffset;
        varying vec2 vUv;
        varying float vTextureIdx;
      `)
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec4 texelColor = vec4(0.0);
        if (vTextureIdx < 1.0) {
          texelColor = texture2D(letterTexture, vUv * vec2(1.0 / atlasTextureSize) + vLetterOffset); 
        } else if (vTextureIdx < 2.0) {
          texelColor = texture2D(imageTexture, vUv * vec2(1.0 / atlasTextureSize) + vLetterOffset); 
          // texelColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
        vec4 baseColor = vec4(0.5, 0.5, 0.5, 1.0); 
        diffuseColor = mix(baseColor, texelColor, texelColor.a);
      `)
    }

    this._sideMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        wUniforms,
        {
          lightPosition: { value: lightPosition },
          atlasTextureSize: { value: atlasTextureSize },
        }
      ]),
      lights: true,
      vertexShader: wVertex,
      fragmentShader: wFragment,
      depthPacking: THREE.RGBADepthPacking,
    })


    // const materials = [
    //   this._sideMaterial,
    //   this._sideMaterial,
    //   this._sideMaterial,
    //   this._sideMaterial,
    //   this._frontMaterial,
    //   this._sideMaterial,
    // ]

    const materials = this._frontMaterial

    this._mesh = new THREE.InstancedMesh(this._geometry, materials, this._numBoxes)
    this._mesh.rotation.set(...rotation)
    this._mesh.castShadow = true
    this._mesh.receiveShadow = true
    this._mesh.visible = false
    // this._mesh.position.set(0, 0, -this._radius / 2)

    for (let i = 0; i < this._numBoxes; i++) {
      const xIdx = i % this._radius
      const yIdx = (i - xIdx) / this._radius
      const x = xIdx - this._radius / 2
      const y = yIdx - this._radius / 2
      this._boxPosition.set(x, y, 0)
      this._boxScale.set(1, 1, 1)
      this._matrix.compose(
        this._boxPosition,
        this._boxRotation,
        this._boxScale
      )
      this._mesh.setMatrixAt(i, this._matrix)
    }
    this._mesh.customDepthMaterial = new THREE.MeshDepthMaterial( {
      depthPacking: THREE.RGBADepthPacking,
      // alphaTest: 0.8
    } );
    this._mesh.customDepthMaterial.onBeforeCompile = shader => {
        // app specific instancing shader code
        // shader.vertexShader = '#define DEPTH_PACKING 3201'+"\n"+THREE.ShaderChunk.instance_pars_vertex + "\n" + shader.vertexShader;
        // shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>'+THREE.ShaderChunk.instance_vertex);
      
        // shader.fragmentShader = '#define DEPTH_PACKING 3201'+"\n" + shader.fragmentShader;
    } 
  }
  get mesh () {
    return this._mesh
  }

  set visible (visible) {
    if (!visible) {
      const {
        texCoordinates
      } = this._textureManager.getEntryTexCoordinate(' ', 'characters')
      for (let i = 0; i < this._numBoxes; i++) {
        this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[0]
        this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[1]
        this._mesh.geometry.attributes.textureIdx.array[i] = 0
      }
    } else {
      this._frontMaterial.uniforms.letterTexture.value = this._textureManager.getTexture('characters').texture
      this._frontMaterial.uniforms.imageTexture.value = this._textureManager.getTexture('/assets/biest.png').texture
    }
    this._mesh.visible = visible
  }

  set interactable (interactable) {
    if (!interactable) {
      for (let i = 0; i < this._numBoxes; i++) {
        // this._mesh.geometry.attributes.scale.array[i] = 1
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
    this._screenData = screenData
    Object.entries(screenData).map(keyValue => {
      const key = keyValue[0]
      const { x, y, type } = keyValue[1]
      const startIdx = x + this._radius * (this._radius - y)
      if (type === ENTRY_TYPE_IMAGE) {
        const entry = {
          value: keyValue[1].value, type
        }
        const { width, height } = keyValue[1]
        // console.log('allocating ENTRY_TYPE_IMAGE texture for ' + key)
        const {
          texCoordinates,
          textureUniformIdx
        } = this._textureManager.getEntryTexCoordinate(entry, entry.value)
        for (let i = 0; i < this._numBoxes; i++) {
          const xIdx = i % this._radius
          const yIdx = (i - xIdx) / this._radius
          const startX = x
          const startY = y
          const endX = startX + width
          const endY = startY + height

          if (xIdx >= startX && xIdx <= endX && yIdx > startY && yIdx < endY) {
            this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
            this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[i][0]
            this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[i][1]  
          }

          // if (xIdx > x && xIdx < x + width && yIdx > y && yIdx < y + height) {
          //   this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
          //   this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[i][0]
          //   this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[i][1]
          // }
        }
      } else if (type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
        for (let i = startIdx, n = 0; i < startIdx + key.length; i++) {
          const entry = {
            value: key[n], type
          }
          // console.log('allocating ENTRY_TYPE_INDIVIDUAL_CHAR texture for ' + key)
          const {
            texCoordinates
          } = this._textureManager.getEntryTexCoordinate(entry, 'characters')
          this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[1]
          n++
        }
      } else if (type === ENTRY_TYPE_WORD_LINE) {
        const entry = {
          value: key, x, y, type
        }
        console.log('allocating ENTRY_TYPE_WORD_LINE texture for ' + key)
        const {
          texCoordinates
        } = this._textureManager.getEntryTexCoordinate(entry, 'characters')
        console.log(texCoordinates)
        for (let i = startIdx, n = 0; i < startIdx + texCoordinates.length; i++) {
          this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[n][0]
          this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[n][1]
          n++
        }
      } else if (key === DECORATION_TYPE_BORDER) {
        const entry = { type }
        const {
          texCoordinates
        } = this._textureManager.getEntryTexCoordinate(entry, 'characters')
        for (let i = 0; i < this._numBoxes; i++) {
          const xIdx = i % this._radius
          const yIdx = (i - xIdx) / this._radius
          if (xIdx === 0 || xIdx === this._radius - 1 || yIdx === 0 || yIdx === this._radius - 1) {
            this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[0]
            this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[1]
          } else if (i > 20 && i < 120) {
            this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[0]
            this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[1]
          }
        }
      } else {
        const {
          texCoordinates
        } = this._textureManager.getEntryTexCoordinate(' ', 'characters')
        for (let i = 0; i < this._numBoxes; i++) {
          this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[1]
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
          const { x, y, type, linksTo } = keyValue[1]


          if (key === DECORATION_TYPE_BORDER) {
            return
          }

          if (!linksTo) {
            return
          }

          // this._matrix.identity()

            this._dummy.matrix.identity()

          if (type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
            if (instanceXIdx >= x && instanceXIdx < x + key.length && instanceYIdx === y) {
              const startIdx = x + this._radius * (this._radius - y)
              for (let n = startIdx; n < startIdx + key.length; n++) {
                const xIdx = n % this._radius
                const yIdx = (n - xIdx) / this._radius
                const x = xIdx - this._radius / 2
                const y = yIdx - this._radius / 2
                this._dummy.position.set(x, y, 0)
                this._dummy.scale.set(1, 1, HOVERED_SCALE)
                this._dummy.updateMatrix()
                this._mesh.setMatrixAt(n, this._dummy.matrix)
              }

              this._mesh.instanceMatrix.needsUpdate = true
              hoveredItem = { key, linksTo }
            }
          } else if (type === ENTRY_TYPE_WORD_LINE) {
            const entry = {
              value: key, x, y, type
            }
            const startIdx = x + this._radius * (this._radius - y)
            const {
              texCoordinates
            } = this._textureManager.getEntryTexCoordinate(entry)
            if (instanceXIdx >= x && instanceXIdx < x + texCoordinates.length && instanceYIdx === y) {
              for (let i = startIdx; i < startIdx + texCoordinates.length; i++) {
                const xIdx = i % this._radius
                const yIdx = (i - xIdx) / this._radius
                const x = xIdx - this._radius / 2
                const y = yIdx - this._radius / 2
                this._dummy.position.set(x, y, 0)
                this._dummy.scale.set(1, 1, HOVERED_SCALE)
                this._dummy.updateMatrix()
                this._mesh.setMatrixAt(i, this._dummy.matrix)
              }
              this._mesh.instanceMatrix.needsUpdate = true
              hoveredItem = { key, linksTo }
            }
          }        
        })

        if (hoveredItem) {
            if (!document.body.classList.contains('hovering')) {
              document.body.classList.add('hovering')
            }
        } else {
          if (document.body.classList.contains('hovering')) {
            document.body.classList.remove('hovering')
          }
          for (let i = 0; i < this._numBoxes; i++) {
            const xIdx = i % this._radius
            const yIdx = (i - xIdx) / this._radius
            const x = xIdx - this._radius / 2
            const y = yIdx - this._radius / 2
            this._dummy.position.set(x, y, 0)
            this._dummy.scale.set(1, 1, 1)
            this._dummy.updateMatrix()
            this._mesh.setMatrixAt(i, this._dummy.matrix)
          }
          this._mesh.instanceMatrix.needsUpdate = true
        }
      }
      // console.log(hoveredItem, oldHoveredItem)


      // console.log(hoveredItem)
      
      if (this._interactable) {
        store.dispatch(setEntryHover(hoveredItem))
      }

      

      
      
    } else {
      if (this._interactable) {
        store.dispatch(setEntryHover(null))
      }
    }

    this._mesh.geometry.attributes.textureIdx.needsUpdate = true
    this._mesh.geometry.attributes.letterOffset.needsUpdate = true
  }
}
