import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLICKS_REQUIRED,
  TRACKS,
  installEasterEgg,
  pickRandomTrack,
  registerClick,
  resetEasterEgg,
} from './easterEgg'

class FakeAudio {
  constructor(src) {
    this.src = src
    this.paused = true
    this.currentTime = 0
    FakeAudio.instances.push(this)
  }

  play() {
    this.paused = false
    return Promise.resolve()
  }

  pause() {
    this.paused = true
  }
}
FakeAudio.instances = []

describe('easter egg audio', () => {
  beforeEach(() => {
    FakeAudio.instances = []
    resetEasterEgg()
    vi.stubGlobal('Audio', FakeAudio)
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('exposes the funny-music track list', () => {
    expect(TRACKS.length).toBeGreaterThan(0)
    expect(TRACKS[0]).toContain('/audio/funny%20music/')
  })

  it('pickRandomTrack returns a track from the list', () => {
    expect(pickRandomTrack()).toBe(TRACKS[0])
    expect(pickRandomTrack([])).toBeNull()
  })

  it(`plays a random track after exactly ${CLICKS_REQUIRED} clicks`, () => {
    for (let i = 0; i < CLICKS_REQUIRED - 1; i += 1) {
      expect(registerClick()).toBeNull()
    }
    expect(FakeAudio.instances).toHaveLength(0)

    expect(registerClick()).toBeInstanceOf(FakeAudio)
    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0].src).toBe(TRACKS[0])
    expect(FakeAudio.instances[0].paused).toBe(false)
  })

  it('restarts the counter after a trigger and stops the previous clip', () => {
    for (let i = 0; i < CLICKS_REQUIRED; i += 1) registerClick()
    const first = FakeAudio.instances[0]

    for (let i = 0; i < CLICKS_REQUIRED; i += 1) registerClick()
    expect(FakeAudio.instances).toHaveLength(2)
    expect(first.paused).toBe(true)
    expect(FakeAudio.instances[1].paused).toBe(false)
  })

  it('installEasterEgg wires clicks on the target and removes them on uninstall', () => {
    const target = document.createElement('div')
    const remove = installEasterEgg(target)

    for (let i = 0; i < CLICKS_REQUIRED; i += 1) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
    expect(FakeAudio.instances).toHaveLength(1)

    remove()
    resetEasterEgg()
    for (let i = 0; i < CLICKS_REQUIRED; i += 1) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
    expect(FakeAudio.instances).toHaveLength(1)
  })
})
