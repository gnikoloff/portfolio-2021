import {
  ENTRY_TYPE_IMAGE
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
        if (resource.type === ENTRY_TYPE_IMAGE) {
          return loadImage({ src: resource.src }).then(res => {
            loadedProgress += step
            eventEmitter.emit('loaded-resource', { resource, loadedProgress })
            return {
              ...resource,
              value: res
            }
          })
          .catch(err => {
            throw new Error(err)
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

