export const SET_HOVERING_ENTRY = 'SET_HOVERING_ENTRY'
export const setEntryHover = hoverEntryName => ({
  type: SET_HOVERING_ENTRY,
  hoverEntryName,
})

export const SET_LOAD_PROGRESS = 'SET_LOAD_PROGRESS'
export const setLoadProgress = loadProgress => ({
  type: SET_LOAD_PROGRESS,
  loadProgress
})

export const SET_DEBUG_MODE = 'SET_DEBUG_MODE'
export const setDebugMode = isDebugMode => ({
  type: SET_DEBUG_MODE,
  isDebugMode
})
