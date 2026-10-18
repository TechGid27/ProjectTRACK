export function lguQuery(name) {
  return name.replace(/^City of /, '').replace(/ City$/, '')
}

export function projectContractor(project) {
  return project.relations?.find((r) => r.rel === 'CONTRACTED_TO')?.target ?? null
}
