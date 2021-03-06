import * as THREE from 'three'

import store from './store'

import {
  setEntryHover,
} from './store/actions'

import {
  createShaderMaterial,
} from './helpers'

import AllocationManager from './managers/AllocationManager'

import {
  ENTRY_TYPE_IMAGE,
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  VIEW_HOME,
  ENTRY_TYPE_SYMBOL_DOT,
  TEXTURE_LABEL_ATLAS,

  EVT_LOADED_TEXTURES,
  EVT_TRANSITIONING,
  EVT_TRANSITIONING_START,
  EVT_TRANSITIONING_END,
} from './constants'

import styles from './label-styles.json'

const HOVERED_SCALE = 5
const DEFAULT_COLOR = [0, 0, 0]

const styleMap = new Map(Object.entries(styles))

export default class CubeView {
  constructor ({
    radius,
    textureManager,
  }) {
    this._textureManager = textureManager
    this._radius = radius
    this._numBoxes = radius * radius
    this._interactable = false
    this._transitioning = false

    this._viewRotation = new THREE.Quaternion()
    this._dummy = new THREE.Object3D()

    this._scales = new Float32Array(this._numBoxes).fill(1)
    this._scaleTargets = new Float32Array(this._numBoxes).fill(1)
    this._transitioningScaleTargets = new Float32Array(this._numBoxes).fill(1)

    // for (let i = 0; i < this._numBoxes; i++) {
    //   this._scaleTargets[i] = Math.random() * 8 + 2
    // }

    this._screenData = null

    document.addEventListener(EVT_LOADED_TEXTURES, this._onLoadedTextures.bind(this))
    document.addEventListener(EVT_TRANSITIONING, this._onTransition.bind(this))
    document.addEventListener(EVT_TRANSITIONING_START, this._onTransitionStart.bind(this))
    document.addEventListener(EVT_TRANSITIONING_END, this._onTransitionEnd.bind(this))
  }
  init = () => new Promise(resolve => {
    let frontMaterial
    let sideMaterial

    const { entriesPerRow, texture: charactersAtlasTexture } = this._textureManager.getTexture(TEXTURE_LABEL_ATLAS)

    const frontMaterialUniforms = {
      textures: { value: [charactersAtlasTexture], type: 'tv' }
    }

    const createMesh = () => {
      const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
      geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.5))

      const { entriesPerRow } = this._textureManager.getTexture(TEXTURE_LABEL_ATLAS)

      const letterOffsets = new Float32Array(this._numBoxes * 2)
      const textureIndices = new Float32Array(this._numBoxes)
      const textureUvOffsets = new Float32Array(this._numBoxes * 2)
      const textColors = new Float32Array(this._numBoxes * 3)

      for (let i = 0; i < this._numBoxes; i++) {
        const x = i % entriesPerRow / this._radius
        const y = (i - x) / entriesPerRow / this._radius
        textureUvOffsets[i * 2] = x
        textureUvOffsets[i * 2 + 1] = y
      }

      geometry.setAttribute('textureAtlasOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))
      geometry.setAttribute('textureIdx', new THREE.InstancedBufferAttribute(textureIndices, 1))
      geometry.setAttribute('textureUVOffset', new THREE.InstancedBufferAttribute(textureUvOffsets, 2))
      geometry.setAttribute('textColor', new THREE.InstancedBufferAttribute(textColors, 3))
      
      const materials = [
        sideMaterial,
        sideMaterial,
        sideMaterial,
        sideMaterial,
        frontMaterial,
        sideMaterial,
      ]

      this._mesh = new THREE.InstancedMesh(geometry, materials, this._numBoxes)
      this._mesh.castShadow = true
      this._mesh.receiveShadow = true
      this._mesh.visible = false
      this._mesh.customFrontFaceUniforms = frontMaterialUniforms

      for (let i = 0; i < this._numBoxes; i++) {
        this._mesh.setColorAt(i, new THREE.Color(0xEEEEEE).setScalar(0.82 + Math.random() * 0.18))
      }

      resolve(this._mesh)
    }

    const allocManager = AllocationManager.getInstance()

    allocManager
      .allocate(() => {
        const material = createShaderMaterial({
          uniforms: frontMaterialUniforms,
          vertexShaderSnippets: {
            'void main() {': `
              // uniform mat3 uvTransform;

              attribute float textureIdx;
              attribute vec2 textureUVOffset;
              attribute vec2 textureAtlasOffset;
              attribute vec3 textColor;
        
              varying float vTextureIdx;
              varying vec2 vTextureUVOffset;
              varying vec2 vTextureAtlasOffset;
              varying vec3 vTextColor;
        
              void main () {
                vTextureIdx = textureIdx;
                // vUv = (uvTransform * vec3( uv, 1 )).xy;
                vTextureUVOffset = textureUVOffset;
                vTextureAtlasOffset = textureAtlasOffset;
                vTextColor = textColor;
            `
          },
          fragmentShaderSnippets: {
            '#include <bumpmap_pars_fragment>': `
              uniform sampler2D textures[4];

              varying float vTextureIdx;
              // varying vec2 vUv;
              varying vec2 vTextureUVOffset;
              varying vec2 vTextureAtlasOffset;
              varying vec3 vTextColor;

              #ifdef USE_BUMPMAP
                uniform sampler2D bumpMap;
                uniform float bumpScale;
                vec2 dHdxy_fwd() {
                  vec2 transformedUV = vUv * vec2(1.0 / ${entriesPerRow}.0) + vTextureAtlasOffset;
                  vec2 dSTdx = dFdx( transformedUV );
                  vec2 dSTdy = dFdy( transformedUV );
                  float Hll = bumpScale * texture2D( bumpMap, transformedUV ).x;
                  float dBx = bumpScale * texture2D( bumpMap, transformedUV + dSTdx ).x - Hll;
                  float dBy = bumpScale * texture2D( bumpMap, transformedUV + dSTdy ).x - Hll;
                  return vec2( dBx, dBy );
                }
                vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {
                  vec3 vSigmaX = vec3( dFdx( surf_pos.x ), dFdx( surf_pos.y ), dFdx( surf_pos.z ) );
                  vec3 vSigmaY = vec3( dFdy( surf_pos.x ), dFdy( surf_pos.y ), dFdy( surf_pos.z ) );
                  vec3 vN = surf_norm;
                  vec3 R1 = cross( vSigmaY, vN );
                  vec3 R2 = cross( vN, vSigmaX );
                  float fDet = dot( vSigmaX, R1 );
                  fDet *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );
                  vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
                  return normalize( abs( fDet ) * surf_norm - vGrad );
                }
              #endif
            `,
            '#include <color_fragment>': `
                // diffuseColor.rgb *= vColor;

                vec2 transformedUV = vUv * vec2(1.0 / ${entriesPerRow}.0) + vTextureAtlasOffset;

                vec4 typeColor = vec4(vTextColor, 1.0);

                vec4 texelColor = texture2D(textures[0], transformedUV);
                if (vTextureIdx < 1.0) {   
                  diffuseColor = mix(diffuseColor, typeColor, texelColor.a);
                } else if (vTextureIdx < 2.0) {
                  texelColor = texture2D(textures[1], transformedUV);
                  diffuseColor = texelColor;
                } else if (vTextureIdx < 3.0) {
                  texelColor = texture2D(textures[2], transformedUV);
                  diffuseColor = texelColor;
                } else if (vTextureIdx < 4.0) {
                  texelColor = texture2D(textures[3], transformedUV);
                  diffuseColor = texelColor;
                }
          
                // vec2 transformedUV = vUv * vec2(1.0 / ${entriesPerRow}.0) + vTextureUVOffset;
                // diffuseColor.rgb *= texture2D(texture, vUv);
          
            `,
            'gl_FragColor = vec4( outgoingLight, diffuseColor.a );': `
              gl_FragColor = vec4( outgoingLight, diffuseColor.a );
                // gl_FragColor = diffuseColor;
            `
          }
        })
        material.bumpMap = charactersAtlasTexture
        material.needsUpdate = true
        return material
      })
      .then((material) => {
        frontMaterial = material
        if (sideMaterial) {
          createMesh()
        }
      })

    allocManager
      .allocate(() => {
        const material = createShaderMaterial()
        return material
      })
      .then((material) => {
        sideMaterial = material
        if (frontMaterial) {
          createMesh()
        }
      })
  })
  get mesh () {
    return this._mesh
  }

  set visible (visible) {
    if (!visible) {
      const texCoordinates = [-1, -1]
      for (let i = 0; i < this._numBoxes; i++) {
        this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
        this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        this._mesh.geometry.attributes.textureIdx.array[i] = 0
      }
    }

    if (visible) {
      this._mesh.customFrontFaceUniforms.textures.value[0] = this._textureManager.getTexture(TEXTURE_LABEL_ATLAS).texture
      this._mesh.customFrontFaceUniforms.textures.needsUpdate = true
    }

    this._mesh.visible = visible
  }

  set interactable (interactable) {
    this._interactable = interactable
  }

  _onLoadedTextures ({ detail: { imageEntries } }) {
    this._mesh.customFrontFaceUniforms.textures.value = [
      this._textureManager.getTexture(TEXTURE_LABEL_ATLAS).texture,
      ...imageEntries.map(entry => this._textureManager.getTexture(entry.src).texture)
    ]
    this._mesh.customFrontFaceUniforms.textures.needsUpdate = true
  }

  _onTransitionStart ({ detail: { direction } }) {
    this._transitioning = true
    
    if (this.mesh.visible) {
      
      // let lookAtVec
      // if (direction === 0) {
      //   lookAtVec = new THREE.Vector3(-100, 0, 0)
      // } else if (direction === 1) {
      //   lookAtVec = new THREE.Vector3(100, 0, 0)
      // } else if (direction === 2) {
      //   lookAtVec = new THREE.Vector3(0, 100, 0)
      // } else if (direction === 3) {
      //   lookAtVec = new THREE.Vector3(0, -100, 0)
      // }
      // this._mesh.lookAt(lookAtVec)
    }
  }

  _onTransitionEnd () {
    this._transitioning = false
  }

  _onTransition ({ detail: { v } }) {
    // const float pi = 3.14;
    // const float frequency = 10; // Frequency in Hz
    // return 0.5*(1+sin(2 * pi * frequency * time));

    let sinTheta = Math.sin(v * Math.PI)
    if (Math.abs(sinTheta) < Number.EPSILON) {
      sinTheta = 0
    }

    // for (let i = 0; i < this._numBoxes; i++) {
    //   this._scaleTargets[i] = v
    // }
  }
  
  drawScreen (viewName, screenData) {
    if (!screenData) {
      throw new Error('Provided no view screenData')
    }
    this._screenData = screenData
    Object.entries(screenData.entries).map(keyValue => {
      const key = keyValue[0]

      const style = Object.assign({}, keyValue[1], styleMap.get(keyValue[1].styleID))
      
      const { x, y, type } = style
      const startIdx = x + this._radius * (this._radius - y)

      console.log(x, y, type)

      if (key === 'BORDER_DEFINITION') {
        return
      }

      if (type === ENTRY_TYPE_IMAGE) {
        const { width, height } = keyValue[1]
        const {
          texCoordinates,
          textureUniformIdx
        } = this._textureManager.getEntryTexCoordinate({ value: keyValue[1].src }, keyValue[1].src)

        for (let i = 0; i < this._numBoxes; i++) {
          const xIdx = i % this._radius
          const yIdx = (i - xIdx) / this._radius
          const startX = x
          const startY = y
          const endX = startX + width
          const endY = startY + height

          if (xIdx >= startX && xIdx <= endX && yIdx > startY && yIdx < endY) {
            this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
            this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[i][0]
            this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[i][1]  
          }
        }
      } else if (type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
        for (let i = startIdx, n = 0; i < startIdx + key.length; i++) {
          const style = Object.assign({}, keyValue[1], styleMap.get(keyValue[1].styleID))
          const { color = DEFAULT_COLOR } = style
          const entry = {
            value: key[n], type, fontSize: keyValue[1].fontSize, styleID: keyValue[1].styleID
          }
          // console.log('allocating ENTRY_TYPE_INDIVIDUAL_CHAR texture for ' + key)
          console.log(entry)
          const {
            textureUniformIdx,
            texCoordinates
          } = this._textureManager.getEntryTexCoordinate(entry, TEXTURE_LABEL_ATLAS)
          this._mesh.geometry.attributes.textColor.array[i * 3] = color[0]
          this._mesh.geometry.attributes.textColor.array[i * 3 + 1] = color[1]
          this._mesh.geometry.attributes.textColor.array[i * 3 + 2] = color[2]
          this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
          n++
        }
        this._mesh.geometry.attributes.textColor.needsUpdate = true
      } else if (type === ENTRY_TYPE_WORD_LINE) {
        const style = Object.assign({}, keyValue[1], styleMap.get(keyValue[1].styleID))
        const { color = DEFAULT_COLOR, textureXOffset, fontSize } = style
        
        const entry = {
          value: key,
          x,
          y,
          type,
          textureXOffset,
          fontSize,
          hasBorder: keyValue[1].hasB
        }
        const {
          textureUniformIdx,
          texCoordinates
        } = this._textureManager.getEntryTexCoordinate(entry, TEXTURE_LABEL_ATLAS)
        for (let i = startIdx, n = 0; i < startIdx + texCoordinates.length; i++) {
          this._mesh.geometry.attributes.textColor.array[i * 3] = color[0]
          this._mesh.geometry.attributes.textColor.array[i * 3 + 1] = color[1]
          this._mesh.geometry.attributes.textColor.array[i * 3 + 2] = color[2]
          this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[n][0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[n][1]
          n++
        }
        this._mesh.geometry.attributes.textColor.needsUpdate = true
      } else {
        const {
          textureUniformIdx,
        } = this._textureManager.getEntryTexCoordinate({ value: ' ' }, TEXTURE_LABEL_ATLAS)
        const texCoordinates = [-1, -1]
        for (let i = 0; i < this._numBoxes; i++) {
          this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        }
      }
    })

    for (let i = 0; i < this._numBoxes; i++) {
      const entry = {
        type: Math.random() > 0.7 ? ENTRY_TYPE_SYMBOL_DOT : 'CROSS'
      }
      const {
        textureUniformIdx,
        texCoordinates
      } = this._textureManager.getEntryTexCoordinate(entry, TEXTURE_LABEL_ATLAS)
      const xIdx = i % this._radius
      const yIdx = (i - xIdx) / this._radius
      if (viewName === 'INFO') {
        // if (xIdx === 0 || xIdx === this._radius - 1 || yIdx === 0 || yIdx === this._radius - 1) {
        //   this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        // } else if (i > 20 && i < 80) {
        //   // this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
        //   // this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        // }
      } else {
        // const hasDecoration = screenData.entries['BORDER_DEFINITION'] && screenData.entries['BORDER_DEFINITION'].indices.some(indice => indice === i)
        // if (hasDecoration) {
        //   this._mesh.geometry.attributes.textureIdx.array[i] = textureUniformIdx
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        // }
        
        // if (xIdx % 2 === 0 && yIdx % 2 !== 0 ) {
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        // } else {

        // }
      }
    }

    this._mesh.geometry.attributes.textureIdx.needsUpdate = true
    this._mesh.geometry.attributes.textureAtlasOffset.needsUpdate = true
  }

  onUpdateFrame ({
    dt,
    raycaster,
  }) {
    if (!this._mesh) {
      return null
    }
    const intersection = raycaster.intersectObject(this._mesh)

    let instanceId

    if (intersection.length > 0 && this._interactable && !this._transitioning) {
      instanceId = intersection[0] && intersection[0].instanceId
      // console.log(instancId)
      const instanceXIdx = instanceId % this._radius
      const instanceYIdx = this._radius - (instanceId - instanceXIdx) / this._radius


      let hoveredItem

      if (this._screenData) {
        Object.entries(this._screenData.entries).forEach(keyValue => {
          const key = keyValue[0]

          const style = Object.assign({}, keyValue[1], styleMap.get(keyValue[1].styleID))
          const { x, y, type, linksTo } = style

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
              value: key, x, y, type, textureXOffset: style.textureXOffset, fontSize: style.fontSize
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
