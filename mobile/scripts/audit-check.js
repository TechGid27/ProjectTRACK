#!/usr/bin/env node
/*
 * Allowlist-aware npm audit gate (mobile).
 * ----------------------------------------
 * Runs `npm audit --json`, drops advisories listed in .npm-audit-allow.json
 * (the known-unfixable Expo SDK 52 / React Native build-toolchain set), and
 * fails the build ONLY if a high/critical advisory appears that is NOT on the
 * allowlist. This keeps the security gate meaningful for genuinely new issues
 * while not blocking CI on vulnerabilities that can only be resolved by an
 * upstream Expo release.
 *
 * Usage: node scripts/audit-check.js
 */
'use strict'

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const FAIL_LEVELS = new Set(['high', 'critical'])
const allowPath = path.join(__dirname, '..', '.npm-audit-allow.json')

let allow = new Set()
try {
  const raw = JSON.parse(fs.readFileSync(allowPath, 'utf8'))
  allow = new Set(raw.allow || [])
} catch (e) {
  console.error(`Could not read allowlist at ${allowPath}: ${e.message}`)
  process.exit(2)
}

// `npm audit` exits non-zero when vulns exist; capture stdout regardless.
let auditJson = ''
try {
  auditJson = execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch (e) {
  auditJson = e.stdout ? e.stdout.toString() : ''
}

if (!auditJson) {
  console.error('npm audit produced no JSON output.')
  process.exit(2)
}

const report = JSON.parse(auditJson)
const vulns = report.vulnerabilities || {}

/** Collect GHSA ids for a package's advisories (via[] entries that are objects). */
function advisoryIds(node) {
  const ids = []
  for (const via of node.via || []) {
    if (via && typeof via === 'object' && via.url) {
      ids.push(via.url.replace(/\/$/, '').split('/').pop())
    }
  }
  return ids
}

const offenders = []
for (const [name, node] of Object.entries(vulns)) {
  if (!FAIL_LEVELS.has(node.severity)) continue
  const ids = advisoryIds(node)
  // If every advisory for this package is allowlisted, it is accepted.
  const unlisted = ids.filter((id) => !allow.has(id))
  // Packages whose `via` are only string references (transitive re-exports of
  // an already-reported package) carry no new advisory ids — treat as accepted.
  if (ids.length > 0 && unlisted.length === 0) continue
  if (unlisted.length > 0) {
    offenders.push({ name, severity: node.severity, ids: unlisted })
  }
}

if (offenders.length === 0) {
  const counts = report.metadata?.vulnerabilities || {}
  console.log(
    `npm audit gate passed: all high/critical advisories are allowlisted ` +
      `(Expo toolchain). Raw counts — high: ${counts.high ?? 0}, critical: ${counts.critical ?? 0}.`,
  )
  process.exit(0)
}

console.error('npm audit gate FAILED — new high/critical advisories not on the allowlist:')
for (const o of offenders) {
  console.error(`  • ${o.name} [${o.severity}]: ${o.ids.join(', ')}`)
}
console.error(
  '\nIf these originate from an Expo SDK upgrade and are genuinely unfixable, add ' +
    'their GHSA ids to mobile/.npm-audit-allow.json with justification. Otherwise, fix them.',
)
process.exit(1)
