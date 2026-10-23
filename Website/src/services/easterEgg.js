// Easter egg: every 5 clicks anywhere on the page, play a random track
// from public/audio/funny music/. Only one clip plays at a time — a new
// trigger stops the previous one.

export const CLICKS_REQUIRED = 5

const TRACK_FILES = [
  'ssstik.io_1792762802443.mp3',
  'ssstik.io_1792762958572.mp3',
  'ssstik.io_1792762976610.mp3',
  'ssstik.io_1792762994746.mp3',
  'ssstik.io_1792763085398.mp3',
  'ssstik.io_1792763129000.mp3',
]

export const TRACKS = TRACK_FILES.map(
  (file) => `/audio/funny%20music/${file}`,
)

let clicks = 0
let current = null

export function pickRandomTrack(tracks = TRACKS) {
  if (!tracks.length) return null
  const index = Math.floor(Math.random() * tracks.length)
  return tracks[index]
}

export function stopEasterEggAudio() {
  if (!current) return
  current.pause()
  current.currentTime = 0
  current = null
}

export function playEasterEggTrack(src) {
  stopEasterEggAudio()
  current = new Audio(src)
  current.play().catch(() => {
    // Autoplay can be blocked before any user gesture — ignore.
  })
  return current
}

export function registerClick({ track = pickRandomTrack() } = {}) {
  clicks += 1
  if (clicks < CLICKS_REQUIRED) return null
  clicks = 0
  return playEasterEggTrack(track)
}

export function resetEasterEgg() {
  clicks = 0
  stopEasterEggAudio()
}

export function installEasterEgg(target = document) {
  const onClick = () => registerClick()
  target.addEventListener('click', onClick)
  return () => target.removeEventListener('click', onClick)
}
