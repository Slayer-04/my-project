import { getApiOrigins } from './apiConfig.js'

const DEFAULT_TIMEOUT_MS = 10000

const joinApiUrl = (origin, path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const apiPath = normalizedPath.startsWith('/api') ? normalizedPath : `/api${normalizedPath}`
  return `${origin}${apiPath}`
}

export const fetchApi = async (path, options = {}) => {
  const origins = getApiOrigins()
  let lastError = null
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options

  for (const origin of origins) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(joinApiUrl(origin, path), {
        ...fetchOptions,
        signal: fetchOptions.signal || controller.signal,
      })
      clearTimeout(timeoutId)
      return { response, origin }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error?.name === 'AbortError') {
        lastError = new Error(`Request to ${origin} timed out after ${timeoutMs}ms`)
        continue
      }
      lastError = error
    }
  }

  throw lastError || new Error('Unable to connect to any backend origin.')
}

export const fetchApiJson = async (path, options = {}) => {
  const { response, origin } = await fetchApi(path, options)
  let data = null

  try {
    data = await response.json()
  } catch (_error) {
    data = null
  }

  return { response, data, origin }
}