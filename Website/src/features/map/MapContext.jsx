import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { fetchMapPoints } from '../../services/api'

const MapContext = createContext(null)

export function MapProvider({ children }) {
  const [activeLocation, setActiveLocation] = useState(null)
  const [requestedLgu, setRequestedLgu] = useState(null)
  const [cameraTarget, setCameraTarget] = useState(null)
  const [projectDots, setProjectDots] = useState([])
  const [totalLocationProjects, setTotalLocationProjects] = useState(0)
  const [displayMode, setDisplayMode] = useState('top50')
  const [activeStatusFilter, setStatusFilter] = useState('all')
  // Map legend verification filter: 'all' | 'verified' | 'flagged' | 'unverified'
  const [activeVerificationFilter, setVerificationFilter] = useState('all')
  const [highlightedProjectId, setHighlightedProjectId] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [loadingAll, setLoadingAll] = useState(false)

  // Keep top 50 in ref for instant toggle back
  const top50Cache = useRef(new Map())

  const setSpatialData = useCallback((payload = {}) => {
    const loc = payload.targetLocation || payload.target_location || null
    const center = payload.center
    const zoom = payload.zoom ?? 13
    const projects = payload.projects || []
    const totalCount = payload.totalCount ?? payload.total_count ?? projects.length

    setActiveLocation(loc)
    setProjectDots(projects)
    setTotalLocationProjects(totalCount)
    setDisplayMode('top50')
    setStatusFilter('all')
    setVerificationFilter('all')

    // When the chat narrows to a single project, highlight its pin so the
    // zoomed-in map clearly marks the one the user is asking about.
    if (projects.length === 1 && projects[0] && projects[0].id) {
      setHighlightedProjectId(projects[0].id)
    } else {
      setHighlightedProjectId(null)
    }

    if (loc) {
      setRequestedLgu(loc)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('projecttrack:select-lgu', { detail: loc }),
        )
      }
      if (projects.length > 0) {
        top50Cache.current.set(loc.toLowerCase(), projects)
      }
    }

    if (center && Array.isArray(center) && center.length === 2) {
      setCameraTarget({
        center: [Number(center[0]), Number(center[1])],
        zoom,
        timestamp: Date.now(),
      })
    }
  }, [])

  const clearRequestedLgu = useCallback(() => {
    setRequestedLgu(null)
  }, [])

  const clearSpatialData = useCallback(() => {
    setActiveLocation(null)
    setRequestedLgu(null)
    setProjectDots([])
    setTotalLocationProjects(0)
    setDisplayMode('top50')
    setStatusFilter('all')
    setVerificationFilter('all')
    setHighlightedProjectId(null)
  }, [])

  const loadAllProjects = useCallback(async (municipalityName) => {
    const loc = municipalityName || activeLocation
    if (!loc) return
    setLoadingAll(true)
    try {
      const allPoints = await fetchMapPoints(2000, loc)
      const mapped = allPoints.map((p) => ({
        id: p.id,
        description: p.formatted_address || p.id,
        budget: p.budget || null,
        budget_numeric: p.budget_num ?? null,
        status: p.status || null,
        contractor: p.contractor || null,
        category: p.category || null,
        latitude: p.latitude,
        longitude: p.longitude,
        formatted_address: p.formatted_address || p.municipality,
      }))
      setProjectDots(mapped)
      setDisplayMode('all')
      if (mapped.length > 0) {
        setTotalLocationProjects(mapped.length)
      }
    } catch {
      // silently fallback
    } finally {
      setLoadingAll(false)
    }
  }, [activeLocation])

  const showTop50 = useCallback(() => {
    if (!activeLocation) return
    const cached = top50Cache.current.get(activeLocation.toLowerCase())
    if (cached && cached.length > 0) {
      setProjectDots(cached)
      setDisplayMode('top50')
    }
  }, [activeLocation])

  const highlightProject = useCallback((projectId, coords) => {
    setHighlightedProjectId(projectId)
    if (coords && Array.isArray(coords) && coords.length === 2) {
      setCameraTarget({
        center: [Number(coords[0]), Number(coords[1])],
        zoom: 15,
        timestamp: Date.now(),
      })
    }
  }, [])

  const flyToCoords = useCallback((center, zoom = 14) => {
    if (center && Array.isArray(center) && center.length === 2) {
      setCameraTarget({
        center: [Number(center[0]), Number(center[1])],
        zoom,
        timestamp: Date.now(),
      })
    }
  }, [])

  const value = useMemo(
    () => ({
      activeLocation,
      requestedLgu,
      cameraTarget,
      projectDots,
      totalLocationProjects,
      displayMode,
      activeStatusFilter,
      activeVerificationFilter,
      highlightedProjectId,
      selectedProject,
      loadingAll,
      setSpatialData,
      clearRequestedLgu,
      clearSpatialData,
      loadAllProjects,
      showTop50,
      highlightProject,
      flyToCoords,
      setStatusFilter,
      setVerificationFilter,
      setHighlightedProjectId,
      setSelectedProject,
    }),
    [
      activeLocation,
      requestedLgu,
      cameraTarget,
      projectDots,
      totalLocationProjects,
      displayMode,
      activeStatusFilter,
      activeVerificationFilter,
      highlightedProjectId,
      selectedProject,
      loadingAll,
      setSpatialData,
      clearRequestedLgu,
      clearSpatialData,
      loadAllProjects,
      showTop50,
      highlightProject,
      flyToCoords,
    ],
  )

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMapContext() {
  const context = useContext(MapContext)
  if (!context) {
    return {
      activeLocation: null,
      requestedLgu: null,
      cameraTarget: null,
      projectDots: [],
      totalLocationProjects: 0,
      displayMode: 'top50',
      activeStatusFilter: 'all',
      activeVerificationFilter: 'all',
      highlightedProjectId: null,
      selectedProject: null,
      loadingAll: false,
      setSpatialData: () => {},
      clearRequestedLgu: () => {},
      clearSpatialData: () => {},
      loadAllProjects: () => {},
      showTop50: () => {},
      highlightProject: () => {},
      flyToCoords: () => {},
      setStatusFilter: () => {},
      setVerificationFilter: () => {},
      setHighlightedProjectId: () => {},
      setSelectedProject: () => {},
    }
  }
  return context
}

export default MapContext
