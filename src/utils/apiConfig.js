const BACKEND_PORT = 5000

const isBrowser = typeof window !== 'undefined'

const resolveUrl = value => {
  if (!value) return null

  try {
    return new URL(value, isBrowser ? window.location.href : `http://localhost:${BACKEND_PORT}`)
  } catch (_error) {
    return null
  }
}

const uniqueOrigins = origins => {
  const seen = new Set()
  return origins.filter(origin => {
    if (!origin || seen.has(origin)) return false
    seen.add(origin)
    return true
  })
}

export const getApiOrigins = () => {
  const browserCandidates = isBrowser && window.location?.hostname
    ? [
        `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`,
        `http://localhost:${BACKEND_PORT}`,
        `http://127.0.0.1:${BACKEND_PORT}`,
      ]
    : [`http://localhost:${BACKEND_PORT}`, `http://127.0.0.1:${BACKEND_PORT}`]

  const envCandidates = [import.meta.env.VITE_API_URL]
    .map(resolveUrl)
    .filter(Boolean)
    .map(url => url.origin)

  return uniqueOrigins([...envCandidates, ...browserCandidates])
}

export const getBackendOrigin = () => getApiOrigins()[0] || `http://localhost:${BACKEND_PORT}`

export const getApiBaseUrl = () => `${getBackendOrigin()}/api`

export const getSocketUrl = () => getBackendOrigin()