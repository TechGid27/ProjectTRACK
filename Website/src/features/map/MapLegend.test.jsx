import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapProvider } from './MapContext'
import MapLegend from './MapLegend'

function renderLegend() {
  return render(
    <MapProvider>
      <MapLegend />
    </MapProvider>,
  )
}

describe('MapLegend (interactive filters)', () => {
  it('toggles the Photo Flagged verification filter on click', () => {
    renderLegend()
    const flagged = screen.getByRole('button', { name: /photo flagged/i })
    expect(flagged).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(flagged)
    expect(flagged).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(flagged)
    expect(flagged).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the active verification filter (single selection)', () => {
    renderLegend()
    const verified = screen.getByRole('button', { name: /on-site verified/i })
    const anomalies = screen.getByRole('button', { name: /all anomalies/i })
    fireEvent.click(verified)
    expect(verified).toHaveAttribute('aria-pressed', 'true')
    expect(anomalies).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(anomalies)
    expect(verified).toHaveAttribute('aria-pressed', 'false')
    expect(anomalies).toHaveAttribute('aria-pressed', 'true')
  })

  it('status buttons toggle the active status filter', () => {
    renderLegend()
    const ongoing = screen.getByRole('button', { name: /^ongoing$/i })
    const all = screen.getByRole('button', { name: /^all$/i })
    expect(ongoing.className).not.toContain('ring-1')
    fireEvent.click(ongoing)
    expect(ongoing.className).toContain('ring-amber-400/50')
    fireEvent.click(all)
    expect(ongoing.className).not.toContain('ring-amber-400/50')
  })
})
