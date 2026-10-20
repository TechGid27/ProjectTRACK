/**
 * Verification Badges (Pillar 5 — Epistemic UI Badging)
 * =====================================================
 * Renders the shared report verification verdict the backend returns:
 *   status, distance_meters, geofence_pass, forensics_verdict,
 *   reporter_reputation, created_at.
 * The same verdict semantics are mirrored on mobile so badges read identically
 * across clients. Styles/formatters live in ./verificationBadges.helpers.js so
 * this file only exports a component (React Fast Refresh friendly).
 */
import {
  STATUS_STYLES,
  FORENSICS_STYLES,
  formatDistance,
  formatTimestamp,
} from './verificationBadges.helpers'

function Pill({ label, cls, testId }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${cls}`}
    >
      {label}
    </span>
  )
}

/**
 * Compact badge strip for a single report verdict.
 * @param {object} props.report - a ReportRecord/ReportVerification shape.
 */
export default function VerificationBadges({ report }) {
  if (!report) return null
  const status = STATUS_STYLES[report.status] ?? {
    label: report.status ?? 'Unknown',
    cls: 'bg-white/10 text-white/60 border-white/20',
  }
  const forensics = FORENSICS_STYLES[report.forensics_verdict] ?? null

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="verification-badges">
      <Pill label={status.label} cls={status.cls} testId="badge-status" />
      <Pill
        label={formatDistance(report.distance_meters)}
        cls={
          report.geofence_pass
            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
            : 'bg-white/10 text-white/55 border-white/20'
        }
        testId="badge-distance"
      />
      {forensics && <Pill label={forensics.label} cls={forensics.cls} testId="badge-forensics" />}
      {typeof report.reporter_reputation === 'number' && (
        <Pill
          label={`Reporter: ${report.reporter_reputation}`}
          cls="bg-sky-500/15 text-sky-200 border-sky-400/30"
          testId="badge-reputation"
        />
      )}
      {report.created_at && (
        <span className="text-[9px] text-white/40" data-testid="badge-timestamp">
          {formatTimestamp(report.created_at)}
        </span>
      )}
    </div>
  )
}
