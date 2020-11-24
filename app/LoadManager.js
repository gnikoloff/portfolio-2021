import WebFont from 'webfontloader'

import {
  RESOURCE_IMAGE,
  RESOURCE_FONT
} from './constants'

import {
  loadImage
} from './helpers'

import eventEmitter from './event-emitter'

let instance

export default class LoadManager {
  static init () {
    if (!instance) {
      instance = new LoadManager()
    }
    return instance
  }
  constructor () {
    this._resourcesToLoad = []
  }
  addResourceToLoad (entry) {
    this._resourcesToLoad.push(entry)
  }
  loadResources () {
    const step = 1 / this._resourcesToLoad.length
    let loadedProgress = 0
    return Promise
      .all(this._resourcesToLoad.map((resource, i) => {
        if (resource.type === RESOURCE_IMAGE) {
          return loadImage({ src: resource.src }).then(res => {
            loadedProgress += step
            console.log(loadedProgress)
            eventEmitter.emit('loaded-resource', { resource, loadedProgress })
            return {
              ...resource,
              value: res
          }
          })
          .catch(err => {
            throw new Error(err)
          })
        } else if (resource.type === RESOURCE_FONT) {
          return new Promise((resolve, reject) => {
            WebFont.load({
              google: { families: [resource.fontName] },
              text: resource.text,
              fontactive: () => {
                loadedProgress += step
                console.log(loadedProgress)
                eventEmitter.emit('loaded-resource', { resource, loadedProgress })
                resolve(resource)
              },
              fontinactive: fontName => reject(new Error('Font family failed to load', fontName))
            })
          })
        }
      }))
      .then(allResources => {
        eventEmitter.emit('loaded-all-resources', { allResources })
        return allResources
      })
      .catch(err => {
        throw new Error(err)
      })
  }
}

