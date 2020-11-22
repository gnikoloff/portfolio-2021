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

const HOVERED_SCALE = 5

const createShaderMaterial = ({
  textures,
  textureSize,
  vertexShaderSnippets = {},
  fragmentShaderSnippets = {}
} = {}) => {
  const wVertex = THREE.ShaderLib.lambert.vertexShader
  const wFragment = THREE.ShaderLib.lambert.fragmentShader
  const wUniforms = THREE.ShaderLib.lambert.uniforms
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      wUniforms,
      textures
        ? {
          textureSize: { value: textureSize },
          textures: {
            type: 'tv',
            value: textures
          }
        }
        : {}
    ]),
    lights: true,
    vertexShader: wVertex,
    fragmentShader: wFragment
  })
  material.onBeforeCompile = shader => {
    Object.entries(vertexShaderSnippets).forEach(keyValue => {
      const key = keyValue[0]
      const value = keyValue[1]
      shader.vertexShader = shader.vertexShader.replace(key, value)
    })
    Object.entries(fragmentShaderSnippets).forEach(keyValue => {
      const key = keyValue[0]
      const value = keyValue[1]
      shader.fragmentShader = shader.fragmentShader.replace(key, value)
    })
  }
  return material
}

export default class CubeView {
  constructor ({
    radius,
    imageEntries
  }) {
    this._textureManager = TextureManager.getInstance()
    this._imageEntries = imageEntries
    this._radius = radius
    this._numBoxes = radius * radius
    this._interactable = false
    this._transitioning = false

    this._viewRotation = new THREE.Quaternion()
    this._dummy = new THREE.Object3D()

    this._scales = new Float32Array(this._numBoxes).fill(1)
    this._scaleTargets = new Float32Array(this._numBoxes).fill(1)
    this._transitioningScaleTargets = new Float32Array(this._numBoxes).fill(1)

    this._screenData = null

    const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
    geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.5))

    const letterOffsets = new Float32Array(this._numBoxes * 2)
    const textureIndices = new Float32Array(this._numBoxes)

    geometry.setAttribute('letterOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))
    geometry.setAttribute('textureIdx', new THREE.InstancedBufferAttribute(textureIndices, 1))

    const letterTextureData = this._textureManager.getTexture('characters')
    const textures = [
      letterTextureData.texture,
      ...imageEntries.map(entry => this._textureManager.getTexture(entry.value).texture)
    ]

    const textureSize = new THREE.Vector2(letterTextureData.entriesPerRow, letterTextureData.entriesPerRow)

    const frontMaterial = createShaderMaterial({
      textures,
      textureSize,
      vertexShaderSnippets: {
        'varying vec3 vLightFront;': `
          attribute vec2 letterOffset;
          attribute float textureIdx;
          uniform mat3 uvTransform;
          varying vec2 vUv;
          varying vec3 vLightFront;
          varying vec2 vLetterOffset;
          varying float vTextureIdx;
        `,
        '#include <uv_vertex>': `
          vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
          vLetterOffset = letterOffset;
          vTextureIdx = textureIdx;
        `
      },
      fragmentShaderSnippets: {
        'uniform vec3 diffuse;': `
          uniform vec3 diffuse;
          uniform sampler2D textures[${textures.length}];
          uniform vec2 textureSize;
          varying vec2 vLetterOffset;
          varying vec2 vUv;
          varying float vTextureIdx;
        `,
        '#include <map_fragment>': `
          // vec4 texelColor = vec4(0.0);
          vec2 transformedUV = vUv * vec2(1.0 / textureSize) + vLetterOffset;
          // if (vTextureIdx < 1.0) {
          //   texelColor = texture2D(textures[0], transformedUV);
          // } else if (vTextureIdx < 2.0) {
          //   texelColor = texture2D(textures[1], transformedUV);
          // } else if (vTextureIdx < 3.0) {
          //   texelColor = texture2D(textures[2], transformedUV);
          // } else if (vTextureIdx < 4.0) {
          //   texelColor = texture2D(textures[3], transformedUV);
          // }

          vec4 texelColor = texture2D(textures[0], transformedUV);
  
          // float borderWidth = 0.05;
          // float aspect = 1.0;

          // float maxX = 1.0 - borderWidth;
          // float minX = borderWidth;
          // float maxY = maxX / aspect;
          // float minY = minX / aspect;

          // vec4 baseColor; 
          // if (vUv.x < maxX && vUv.x > minX && vUv.y < maxY && vUv.y > minY) {
          //   baseColor = vec4(0.5, 0.5, 0.5, 1.0);
          // } else {
          //   baseColor = vec4(1.0, 0.5, 0.5, 1.0);
          // }
          vec4 baseColor = vec4(0.5, 0.5, 0.5, 1.0);

          diffuseColor = mix(baseColor, texelColor, texelColor.a);
        `
      }
    })

    const sideMaterial = createShaderMaterial({
      fragmentShaderSnippets: {
        '#include <map_fragment>': `
          vec4 baseColor = vec4(0.5, 0.5, 0.5, 1.0);
          diffuseColor = baseColor;
        `
      }
    })

    // const materials = [
    //   sideMaterial,
    //   sideMaterial,
    //   sideMaterial,
    //   sideMaterial,
    //   frontMaterial,
    //   sideMaterial,
    // ]

    const materials = frontMaterial

    this._mesh = new THREE.InstancedMesh(geometry, materials, this._numBoxes)
    this._mesh.castShadow = true
    this._mesh.receiveShadow = true
    this._mesh.visible = false

    this._mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })

    eventEmitter.on('transitioning', this._onTransition.bind(this))
    eventEmitter.on('transitioning-start', this._onTransitionStart.bind(this))
    eventEmitter.on('transitioning-end', this._onTransitionEnd.bind(this))
  }
  get mesh () {
    return this._mesh
  }

  set visible (visible) {
    // if (!visible) {
    //   const {
    //     texCoordinates
    //   } = this._textureManager.getEntryTexCoordinate(' ', 'characters')
    //   for (let i = 0; i < this._numBoxes; i++) {
    //     this._mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordinates[0]
    //     this._mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordinates[1]
    //     this._mesh.geometry.attributes.textureIdx.array[i] = 0
    //   }
    // } else {
    //   this._mesh.material[4].uniforms.textures.value = [
    //     this._textureManager.getTexture('characters').texture,
    //     ...this._imageEntries.map(entry => this._textureManager.getTexture(entry.value).texture)
    //   ]
    // }
    this._mesh.visible = visible
  }

  set interactable (interactable) {
    if (!interactable) {
      for (let i = 0; i < this._numBoxes; i++) {
        this._scaleTargets[i] = 1
      }
    }
    this._interactable = interactable
  }

  _onTransitionStart (direction) {
    this._transitioning = true
    for (let i = 0; i < this._transitioningScaleTargets.length; i++) {
      this._transitioningScaleTargets[i] = Math.random() * 10 + 2
    }
    if (!this._mesh.visible) {
      let lookAtVec
      if (direction === 0) {
        lookAtVec = new THREE.Vector3(100, 0, 0)
      } else if (direction === 1) {
        lookAtVec = new THREE.Vector3(-100, 0, 0)
      } else if (direction === 2) {
        lookAtVec = new THREE.Vector3(0, 100, 0)
      } else if (direction === 3) {
        lookAtVec = new THREE.Vector3(0, -100, 0)
      }
      this._mesh.lookAt(lookAtVec)
    }
  }

  _onTransitionEnd () {
    this._transitioning = false
  }

  _onTransition (v) {
    // const float pi = 3.14;
    // const float frequency = 10; // Frequency in Hz
    // return 0.5*(1+sin(2 * pi * frequency * time));

    let sinTheta = Math.sin(v * Math.PI)
    if (Math.abs(sinTheta) < Number.EPSILON) {
      sinTheta = 0
    }

    for (let i = 0; i < this._numBoxes; i++) {
      this._scaleTargets[i] = 1 + sinTheta * this._transitioningScaleTargets[i]
    }

    console.log(sinTheta)
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
          this._mesh.geometry.attributes.textureIdx.needsUpdate = true
        }
      } else if (type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
        for (let i = startIdx, n = 0; i < startIdx + key.length; i++) {
          const entry = {
            value: key[n], type, fontSize: keyValue[1].fontSize
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
          value: key, x, y, type, textureXOffset: keyValue[1].textureXOffset, fontSize: keyValue[1].fontSize
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
    this._mesh.geometry.attributes.letterOffset.needsUpdate = true
  }

  onUpdateFrame ({
    dt,
    raycaster,
  }) {
    const intersection = raycaster.intersectObject(this._mesh)

    let instanceId

    if (intersection.length > 0 && this._interactable && !this._transitioning) {
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

          if (type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
            if (instanceXIdx >= x && instanceXIdx < x + key.length && instanceYIdx === y) {
              const startIdx = x + this._radius * (this._radius - y)
              for (let n = startIdx; n < startIdx + key.length; n++) {
                this._scaleTargets[n] = HOVERED_SCALE
              }

              hoveredItem = { key, linksTo }
            }
          } else if (type === ENTRY_TYPE_WORD_LINE) {
            const entry = {
              value: key, x, y, type, textureXOffset: keyValue[1].textureXOffset, fontSize: keyValue[1].fontSize
            }
            const startIdx = x + this._radius * (this._radius - y)
            const {
              texCoordinates
            } = this._textureManager.getEntryTexCoordinate(entry)
            if (instanceXIdx >= x && instanceXIdx < x + texCoordinates.length && instanceYIdx === y) {
              for (let i = startIdx; i < startIdx + texCoordinates.length; i++) {
                this._scaleTargets[i] = HOVERED_SCALE
              }
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
            this._scaleTargets[i] = 1
          }
        }
      }
      
      if (this._interactable) {
        store.dispatch(setEntryHover(hoveredItem))
      }
      
    } else {
      if (this._interactable) {
        store.dispatch(setEntryHover(null))
      }
    }

    for (let i = 0; i < this._numBoxes; i++) {
      this._scales[i] += (this._scaleTargets[i] - this._scales[i]) * (dt * 20)
      // this._scales[i] = this._scaleTargets[i]
      const xIdx = i % this._radius
      const yIdx = (i - xIdx) / this._radius
      const x = xIdx - this._radius / 2
      const y = yIdx - this._radius / 2
      this._dummy.position.set(x, y, this._radius / 2)
      this._dummy.rotation.setFromQuaternion(this._viewRotation)
      this._dummy.scale.set(1, 1, this._scales[i])
      this._dummy.updateMatrix()
      this._mesh.setMatrixAt(i, this._dummy.matrix)
    }
    this._mesh.instanceMatrix.needsUpdate = true
    
  }
}
