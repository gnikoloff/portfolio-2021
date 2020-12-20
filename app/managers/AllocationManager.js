import {
  getGUID,
  dispatchEvent,
} from '../helpers'

import {
  RESOURCE_ALLOCATION,
  DEFAULT_ALLOCATION_TIMEOUT,
  EVT_ADD_TO_LOAD_QUEUE,
  EVT_ALLOCATION_SUCCESS,
} from '../constants'

let instance

export default class AllocationManager {
  static getInstance () {
    if (!instance) {
      instance = new AllocationManager()
    }
    return instance
  }
  constructor () {
    this._allocQueue = []
    this._isAllocating = false
    this._a = Date.now()
  }
  allocate = (callback, timeout = DEFAULT_ALLOCATION_TIMEOUT) => new Promise((resolve) => {
    const alloc = (uid, callback, resolve) => {
      if (this._allocQueue.length) {
        const { callback, resolve } = this._allocQueue.pop()
        const allocUID = getGUID()
        dispatchEvent(EVT_ADD_TO_LOAD_QUEUE, { type: RESOURCE_ALLOCATION, uid: allocUID })
        setTimeout(() => alloc(allocUID, callback, resolve), timeout)
      } else {
        this._isAllocating = false
      }
      // console.log('alloc:', Date.now() - this._a)

      dispatchEvent(EVT_ALLOCATION_SUCCESS, uid)

      const result = callback()
      resolve(result)
      return result
    }
    if (this._isAllocating) {
      this._allocQueue.push({ callback, resolve })
    } else {
      this._isAllocating = true
      const allocUID = getGUID()
      dispatchEvent(EVT_ADD_TO_LOAD_QUEUE, { type: RESOURCE_ALLOCATION, uid: allocUID })
      setTimeout(() => alloc(allocUID, callback, resolve), timeout)
    }
  })
}