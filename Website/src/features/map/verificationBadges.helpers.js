/**
 * Verification badge styles and formatters (Pillar 5).
 * Kept separate from the component file so React Fast Refresh is satisfied
 * (a component module should export only components).
 */

export const STATUS_STYLES = {
  verified: { label: 'Verified', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
  pending: { label: 'Pending Review', cls: 'bg-amber-500/20 text-amber-300 border-amber-400/40' },
  flagged: { label: 'Flagged', cls: 'bg-red-500/20 text-red-300 border-red-400/40' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/25 text-red-200 border-red-400/50' },
}

export const FORENSICS_STYLES = {
  clean: { label: 'Forensics: Clean', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  suspicious: { label: 'Forensics: Suspicious', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  recycled: { label: 'Forensics: Recycled Photo', cls: 'bg-red-500/15 text-red-200 border-red-400/30' },
}

/** Human distance string. Web GPS is lower-trust, so copy says "from site". */
export function formatDistance(distanceMeters) {
  if (distanceMeters == null) return 'Location not provided'
  if (distanceMeters < 1000) return `${distanceMeters}m from site`
  return `${(distanceMeters / 1000).toFixed(1)}km from site`
}

export function formatTimestamp(createdAt) {
  if (!createdAt) return ''
  try {
    return new Date(createdAt).toLocaleString()
  } catch {
    return String(createdAt)
  }
}
