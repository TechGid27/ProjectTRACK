import { describe, expect, it } from 'vitest'
import { statusCategory } from './CebuMap'

describe('statusCategory (pin colors + legend filter)', () => {
  it('classifies plain statuses', () => {
    expect(statusCategory('Ongoing')).toBe('ongoing')
    expect(statusCategory('On-Going')).toBe('ongoing')
    expect(statusCategory('Completed')).toBe('completed')
    expect(statusCategory('Bidding')).toBe('bidding')
    expect(statusCategory('Procurement')).toBe('bidding')
    expect(statusCategory(null)).toBe('other')
  })

  it('treats "On-Going (X% Completed)" as ongoing, not completed', () => {
    // Regression: these strings contain "Completed" as a progress note —
    // the pin must stay amber and they must match the Ongoing legend filter.
    expect(statusCategory('On-Going (62% Completed)')).toBe('ongoing')
    expect(statusCategory('Ongoing (45.5% Completed)')).toBe('ongoing')
    expect(statusCategory('On-Going (99% Completed)')).toBe('ongoing')
  })

  it('still marks true completions as completed', () => {
    expect(statusCategory('Completed (100%)')).toBe('completed')
    expect(statusCategory('100% Completed')).toBe('completed')
    expect(statusCategory('100%')).toBe('completed')
  })
})
