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
  VIEW_HOME,
  ENTRY_TYPE_SYMBOL_DOT,
} from '../constants'

const HOVERED_SCALE = 5

const createShaderMaterial = ({
  uniforms,
  entriesPerRow,
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
    shader.vertexShader = shader.vertexShader.replace('void main() {', `
      // uniform mat3 uvTransform;

      attribute float textureIdx;
      attribute vec2 textureUVOffset;
      attribute vec2 textureAtlasOffset;

      varying float vTextureIdx;
      // varying vec2 vUv;
      varying vec2 vTextureUVOffset;
      varying vec2 vTextureAtlasOffset;

      void main () {
        vTextureIdx = textureIdx;
        // vUv = (uvTransform * vec3( uv, 1 )).xy;
        vTextureUVOffset = textureUVOffset;
        vTextureAtlasOffset = textureAtlasOffset;
    `)
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `

      void main (){
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>', `
      uniform sampler2D textures[4];

      varying float vTextureIdx;
      // varying vec2 vUv;
      varying vec2 vTextureUVOffset;
      varying vec2 vTextureAtlasOffset;
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
    `)
    shader.fragmentShader = shader.fragmentShader.replace(`#include <color_fragment>`, `
      vec4 texelColor = vec4(0.0);
      vec2 transformedUV = vUv * vec2(1.0 / ${entriesPerRow}.0) + vTextureAtlasOffset;
      if (vTextureIdx < 1.0) {
        texelColor = texture2D(textures[0], transformedUV);
      } else if (vTextureIdx < 2.0) {
        texelColor = texture2D(textures[1], transformedUV);
      } else if (vTextureIdx < 3.0) {
        texelColor = texture2D(textures[2], transformedUV);
      } else if (vTextureIdx < 4.0) {
        texelColor = texture2D(textures[3], transformedUV);
      }

      // vec2 transformedUV = vUv * vec2(1.0 / ${entriesPerRow}.0) + vTextureUVOffset;
      // diffuseColor.rgb *= texture2D(texture, vUv);
      diffuseColor.rgb *= vColor;

      vec4 typeColor = vec4(vec3(0.2), 1.0);

      diffuseColor = mix(diffuseColor, typeColor, texelColor.a);
    `)
  }

  return material

  // const wVertex = THREE.ShaderLib.lambert.vertexShader
  // const wFragment = THREE.ShaderLib.lambert.fragmentShader
  // const wUniforms = THREE.ShaderLib.lambert.uniforms
  // const material = new THREE.ShaderMaterial({
  //   uniforms: THREE.UniformsUtils.merge([
  //     wUniforms,
  //     uniforms
  //   ]),
  //   lights: true,
  //   vertexShader: wVertex,
  //   fragmentShader: wFragment
  // })
  // material.onBeforeCompile = shader => {
  //   Object.entries(vertexShaderSnippets).forEach(keyValue => {
  //     const key = keyValue[0]
  //     const value = keyValue[1]
  //     shader.vertexShader = shader.vertexShader.replace(key, value)
  //   })
  //   Object.entries(fragmentShaderSnippets).forEach(keyValue => {
  //     const key = keyValue[0]
  //     const value = keyValue[1]
  //     shader.fragmentShader = shader.fragmentShader.replace(key, value)
  //   })
  // }
  // return material
}

// const createShaderMaterial = ({
//   uniforms,
//   vertexShaderSnippets = {},
//   fragmentShaderSnippets = {}
// } = {}) => {

//   const material = new THREE.MeshStandardMaterial({
//     metalness: 0.5,
//     roughness: 0.3,
//   })

//   return material

//   // const wVertex = THREE.ShaderLib.lambert.vertexShader
//   // const wFragment = THREE.ShaderLib.lambert.fragmentShader
//   // const wUniforms = THREE.ShaderLib.lambert.uniforms
//   // const material = new THREE.ShaderMaterial({
//   //   uniforms: THREE.UniformsUtils.merge([
//   //     wUniforms,
//   //     uniforms
//   //   ]),
//   //   lights: true,
//   //   vertexShader: wVertex,
//   //   fragmentShader: wFragment
//   // })
//   // material.onBeforeCompile = shader => {
//   //   Object.entries(vertexShaderSnippets).forEach(keyValue => {
//   //     const key = keyValue[0]
//   //     const value = keyValue[1]
//   //     shader.vertexShader = shader.vertexShader.replace(key, value)
//   //   })
//   //   Object.entries(fragmentShaderSnippets).forEach(keyValue => {
//   //     const key = keyValue[0]
//   //     const value = keyValue[1]
//   //     shader.fragmentShader = shader.fragmentShader.replace(key, value)
//   //   })
//   // }
//   // return material
// }

export default class CubeView {
  constructor ({
    radius,
  }) {
    this._textureManager = TextureManager.getInstance()
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

    const { entriesPerRow, texture: charactersAtlasTexture } = this._textureManager.getTexture('characters')
    const textureSize = new THREE.Vector2(entriesPerRow, entriesPerRow)

    const letterOffsets = new Float32Array(this._numBoxes * 2)
    const textureIndices = new Float32Array(this._numBoxes)
    const textureUvOffsets = new Float32Array(this._numBoxes * 2)

    for (let i = 0; i < this._numBoxes; i++) {
      const x = i % entriesPerRow / this._radius
      const y = (i - x) / entriesPerRow / this._radius
      textureUvOffsets[i * 2] = x
      textureUvOffsets[i * 2 + 1] = y
    }

    geometry.setAttribute('textureAtlasOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))
    geometry.setAttribute('textureIdx', new THREE.InstancedBufferAttribute(textureIndices, 1))
    geometry.setAttribute('textureUVOffset', new THREE.InstancedBufferAttribute(textureUvOffsets, 2))

    const frontMaterialUniforms = {
      textures: { value: [charactersAtlasTexture], type: 'tv' }
    }

    const frontMaterial = createShaderMaterial({
      uniforms: frontMaterialUniforms,
      entriesPerRow: 20,
    })
    frontMaterial.bumpMap = charactersAtlasTexture
    frontMaterial.needsUpdate = true

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
    this._mesh.customFrontFaceUniforms = frontMaterialUniforms

    for (let i = 0; i < this._numBoxes; i++) {
      this._mesh.setColorAt(i, new THREE.Color(0xaaaaaa).setScalar(0.7 + Math.random() * 0.2))
    }

    eventEmitter.on('loaded-textures', this._onLoadedTextures.bind(this))
    eventEmitter.on('transitioning', this._onTransition.bind(this))
    eventEmitter.on('transitioning-start', this._onTransitionStart.bind(this))
    eventEmitter.on('transitioning-end', this._onTransitionEnd.bind(this))
  }
  get mesh () {
    return this._mesh
  }

  set visible (visible) {
    if (!visible) {
      const {
        texCoordinates
      } = this._textureManager.getEntryTexCoordinate({ value: ' ' }, 'characters')
      for (let i = 0; i < this._numBoxes; i++) {
        this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
        this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        this._mesh.geometry.attributes.textureIdx.array[i] = 0
      }
    }

    if (visible) {
      this._mesh.customFrontFaceUniforms.textures.value[0] = this._textureManager.getTexture('characters').texture
      this._mesh.customFrontFaceUniforms.textures.needsUpdate = true
    }

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

  _onLoadedTextures (imageEntries) {
    // this._imageEntries = imageEntries
    // console.log(this._mesh.material.uniforms.textures)
    // this._mesh.material.uniforms.textures.value = [
    //   this._textureManager.getTexture('characters').texture,
    //   ...imageEntries.map(entry => this._textureManager.getTexture(entry.src).texture)
    // ]
    // this._mesh.material.uniforms.textures.needsUpdate = true
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
  }
  
  drawScreen (viewName, screenData) {
    if (!screenData) {
      throw new Error('Provided no view screenData')
    }
    this._screenData = screenData
    Object.entries(screenData).map(keyValue => {
      const key = keyValue[0]
      const { x, y, type } = keyValue[1]
      const startIdx = x + this._radius * (this._radius - y)

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
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
          n++
        }
      } else if (type === ENTRY_TYPE_WORD_LINE) {
        const entry = {
          value: key, x, y, type, textureXOffset: keyValue[1].textureXOffset, fontSize: keyValue[1].fontSize
        }
        const {
          texCoordinates
        } = this._textureManager.getEntryTexCoordinate(entry, 'characters')
        // console.log(texCoordinates)
        for (let i = startIdx, n = 0; i < startIdx + texCoordinates.length; i++) {
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[n][0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[n][1]
          n++
        }
      } else {
        console.log(key)
        const {
          texCoordinates
        } = this._textureManager.getEntryTexCoordinate({ value: ' ' }, 'characters')
        for (let i = 0; i < this._numBoxes; i++) {
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
        texCoordinates
      } = this._textureManager.getEntryTexCoordinate(entry, 'characters')
      const xIdx = i % this._radius
      const yIdx = (i - xIdx) / this._radius
      if (viewName === VIEW_HOME) {
        if (xIdx === 0 || xIdx === this._radius - 1 || yIdx === 0 || yIdx === this._radius - 1) {
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        } else if (i > 20 && i < 80) {
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        }
      } else if (viewName === 'PROJECTS') {
        const hasDecoration = screenData['BORDER_DEFINITION'].indices.some(indice => indice === i)
        if (hasDecoration) {
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
          this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        }
        
        // if (xIdx % 2 === 0 && yIdx % 2 !== 0 ) {
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2] = texCoordinates[0]
        //   this._mesh.geometry.attributes.textureAtlasOffset.array[i * 2 + 1] = texCoordinates[1]
        // } else {

        // }
      }
    }

    this._mesh.geometry.attributes.textureAtlasOffset.needsUpdate = true
  }

  onUpdateFrame ({
    dt,
    raycaster,
  }) {
    const intersection = raycaster.intersectObject(this._mesh)

    let instanceId

    if (intersection.length > 0 && this._interactable && !this._transitioning) {
      instanceId = intersection[0] && intersection[0].instanceId
      // console.log(instancId)
      const instanceXIdx = instanceId % this._radius
      const instanceYIdx = this._radius - (instanceId - instanceXIdx) / this._radius


      let hoveredItem

      if (this._screenData) {

        
        Object.entries(this._screenData).forEach(keyValue => {
          const key = keyValue[0]
          const { x, y, type, linksTo } = keyValue[1]


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
