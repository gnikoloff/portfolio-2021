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
    // document.body.appendChild(this._texCanvas)
  }
  get texture () {
    return this._texture
  }
  _drawChar (char) {
    const drawX = this._atlasIdxX * this._cellWidth
    const drawY = this._atlasIdxY * this._cellWidth
    this._texCtx.save()
    this._texCtx.fillStyle = '#aaa'
    this._texCtx.fillRect(drawX, drawY, drawX + this._cellWidth, drawY * this._cellWidth + this._cellWidth)
    this._texCtx.fillStyle = 'black'
    this._texCtx.font = `${300}px monospace`
    this._texCtx.textAlign = 'center'
    this._texCtx.translate(drawX + this._cellWidth / 2, drawY + this._cellWidth / 2 + 85)
    this._texCtx.fillText(char, 0, 0)
    this._texCtx.restore()
  }
  _drawDecoration () {
    const drawX = this._atlasIdxX * this._cellWidth
    const drawY = this._atlasIdxY * this._cellWidth
    this._texCtx.save()
    // this._texCtx.fillStyle = 'white'
    this._texCtx.translate(drawX + this._cellWidth / 2, drawY + this._cellWidth / 2)
    this._texCtx.beginPath()
    this._texCtx.arc(0, 0, 50, 0, Math.PI * 2, false)
    this._texCtx.closePath()
    this._texCtx.fill()
    this._texCtx.restore()
  }
  addAtlasEntry (entry) {
    if (entry.type === 'CHAR') {
      this._drawChar(entry.value)
    } else if (entry.type === 'DECORATION') {
      this._drawDecoration()
    }
    // const drawX = this._atlasIdxX * this._cellWidth
    // const drawY = this._atlasIdxY * this._cellWidth
    // this._texCtx.strokeStyle = 'green'
    // this._texCtx.lineWidth = 40
    // this._texCtx.strokeRect(drawX, drawY, drawX + this._cellWidth, drawY + this._cellWidth)
    
    const texAtlasX = this._atlasIdxX / this._entriesPerRow
    const texAtlasY = 1.0 - (this._atlasIdxY + 1) / this._entriesPerRow
    
    this._atlas.set(entry.value || entry.type, [texAtlasX, texAtlasY])

    this._atlasIdxX++

    if (this._atlasIdxX >= this._entriesPerRow) {
      this._atlasIdxX = 0
      this._atlasIdxY++
    }

    this._texture.needsUpdate = true
  }
  getEntryTexCoordinate (entry) {
    if (entry === ' ') {
      return [2, 2]
    }
    const texCoordinates = this._atlas.get(entry)
    if (!texCoordinates) {
      throw new Error('cant find texture coordinate for this entry')
    }
    return texCoordinates
  }
}
