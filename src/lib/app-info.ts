import { version } from '../../package.json'

// Public destinations only; no record data is included in outbound links.
function publicHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

export const appVersion = version
export const feedbackUrl = publicHttpsUrl(import.meta.env.VITE_FEEDBACK_URL)
export const downloadUrl = publicHttpsUrl(import.meta.env.VITE_DOWNLOAD_URL)
