import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import VerificationBadges from './VerificationBadges'
import { formatDistance, formatTimestamp } from './verificationBadges.helpers'

describe('VerificationBadges (Pillar 5)', () => {
  const base = {
    id: 'r1',
    project_id: '24HH0043',
    status: 'verified',
    distance_meters: 45,
    geofence_pass: true,
    forensics_verdict: 'clean',
    reporter_reputation: 59,
    created_at: '2026-10-20T12:00:00+00:00',
  }

  it('renders the verified status badge', () => {
    render(<VerificationBadges report={base} />)
    expect(screen.getByTestId('badge-status')).toHaveTextContent('Verified')
  })

  it('renders distance, forensics, reputation and timestamp badges', () => {
    render(<VerificationBadges report={base} />)
    expect(screen.getByTestId('badge-distance')).toHaveTextContent('45m from site')
    expect(screen.getByTestId('badge-forensics')).toHaveTextContent('Clean')
    expect(screen.getByTestId('badge-reputation')).toHaveTextContent('59')
    expect(screen.getByTestId('badge-timestamp')).toBeInTheDocument()
  })

  it('renders a flagged status with recycled forensics', () => {
    render(
      <VerificationBadges
        report={{ ...base, status: 'flagged', forensics_verdict: 'recycled', geofence_pass: false, distance_meters: 3000 }}
      />,
    )
    expect(screen.getByTestId('badge-status')).toHaveTextContent('Flagged')
    expect(screen.getByTestId('badge-forensics')).toHaveTextContent('Recycled')
    expect(screen.getByTestId('badge-distance')).toHaveTextContent('3.0km from site')
  })

  it('renders a pending status', () => {
    render(<VerificationBadges report={{ ...base, status: 'pending', forensics_verdict: 'suspicious' }} />)
    expect(screen.getByTestId('badge-status')).toHaveTextContent('Pending Review')
  })

  it('returns null when no report is provided', () => {
    const { container } = render(<VerificationBadges report={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('formatDistance handles missing distance', () => {
    expect(formatDistance(null)).toBe('Location not provided')
    expect(formatDistance(120)).toBe('120m from site')
    expect(formatDistance(2500)).toBe('2.5km from site')
  })

  it('formatTimestamp is resilient to bad input', () => {
    expect(formatTimestamp(null)).toBe('')
    expect(formatTimestamp('not-a-date')).toBeTypeOf('string')
  })
})
