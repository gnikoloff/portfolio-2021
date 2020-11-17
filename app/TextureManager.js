import * as THREE from 'three'

export default class TextureManager {
  constructor ({
    size
  } = {}) {
    this._atlas = new Map()
    this._atlasIdxX = 0
    this._atlasIdxY = 0
    this._entriesPerRow = 10

    this._size = size
    this._cellWidth = this._size / this._entriesPerRow

    this._texCanvas = document.createElement('canvas')
    this._texCtx = this._texCanvas.getContext('2d')

    this._texture = new THREE.CanvasTexture(this._texCanvas)

    this._texCanvas.width = this._texCanvas.height = this._size
    this._texCanvas.style.position = 'fixed'
    this._texCanvas.style.top = this._texCanvas.style.left = '24px'
    this._texCanvas.style.transform = 'scale(0.2)'
    this._texCanvas.style.transformOrigin = '0 0'
    document.body.appendChild(this._texCanvas)
  }
  get texture () {
    return this._texture
  }
  addAtlasEntry (entry) {
    this._texCtx.save()
    const drawX = this._atlasIdxX * this._cellWidth
    const drawY = this._atlasIdxY * this._cellWidth
    this._texCtx.fillStyle = 'red'
    this._texCtx.fillRect(drawX, drawY, drawX + this._cellWidth, drawY * this._cellWidth + this._cellWidth)
    this._texCtx.fillStyle = 'black'
    this._texCtx.font = `${200}px monospace`
    this._texCtx.textAlign = 'center'
    this._texCtx.translate(drawX + this._cellWidth / 2, drawY + this._cellWidth / 2)
    this._texCtx.fillText(entry, 0, 0)
    this._texCtx.restore()
    
    const texAtlasX = this._atlasIdxX / this._entriesPerRow
    const texAtlasY = 1.0 - (this._atlasIdxY + 1) / this._entriesPerRow
    
    this._atlas.set(entry, [texAtlasX, texAtlasY])

    this._atlasIdxX++

    if (this._atlasIdxX >= this._entriesPerRow) {
      this._atlasIdxX = 0
      this._atlasIdxY++
    }

    this._texture.needsUpdate = true
  }
  getEntryTexCoordinate (entry) {
    const texCoordinates = this._atlas.get(entry)
    if (!texCoordinates) {
      throw new Error('cant find texture coordinate for this entry')
    }
    return texCoordinates
  }
}
