import { Pin } from '../core/types';
import { normalizeLguName } from '../core/geoUtils';

export const pins: Pin[] = [
  {
    id: 'bogo',
    name: 'Bogo City Central Hub',
    lat: 11.054,
    lng: 124.006,
    tone: 'default',
    report_count: 0,
    is_hotspot: false,
    lgu: 'Bogo City',
    description: 'Northern Cebu district engineering civil works and flood mitigation.',
  },
  {
    id: 'danao',
    name: 'Danao City Coastal Road',
    lat: 10.528,
    lng: 123.938,
    tone: 'default',
    lgu: 'Danao City',
    description: 'Port access road widening and multi-purpose building projects.',
  },
  {
    id: 'consolacion',
    name: 'Consolacion Highway Link',
    lat: 10.37,
    lng: 123.955,
    tone: 'default',
    lgu: 'Consolacion',
    description: 'Metro Cebu drainage improvement and bypass road network.',
  },
  {
    id: 'mandaue',
    name: 'Mandaue City Reclamation Area',
    lat: 10.345,
    lng: 123.96,
    tone: 'default',
    lgu: 'Mandaue City',
    description: 'Subangdaku river retaining wall and bridge seismic retrofitting.',
  },
  {
    id: 'lapu-lapu',
    name: 'Lapu-Lapu City Tourism Corridor',
    lat: 10.312,
    lng: 123.943,
    tone: 'default',
    lgu: 'Lapu-Lapu City',
    description: 'Mactan circumferential road rehabilitation and stormwater pumping.',
  },
  {
    id: 'cebu-city',
    name: 'Cebu City Urban Drainage',
    lat: 10.3157,
    lng: 123.8854,
    tone: 'accent',
    lgu: 'Cebu City',
    description: 'Lahug river flood control and mountain barangay farm-to-market roads.',
  },
  {
    id: 'talisay',
    name: 'Talisay City Coastal Protection',
    lat: 10.334,
    lng: 123.845,
    tone: 'default',
    lgu: 'Talisay City',
    description: 'Mananga river floodwall phase II and bridge replacement.',
  },
  {
    id: 'toledo',
    name: 'Toledo City Transport Terminal',
    lat: 10.377,
    lng: 123.638,
    tone: 'default',
    lgu: 'Toledo City',
    description: 'Trans-axial road linking east and west Cebu mountain passes.',
  },
  {
    id: 'carcar',
    name: 'Carcar City Heritage Bypass',
    lat: 10.107,
    lng: 123.641,
    tone: 'default',
    report_count: 0,
    is_hotspot: false,
    lgu: 'Carcar City',
    description: 'Bypass road diversion structure and public market access.',
  },
  {
    id: 'argao',
    name: 'Argao Watershed Flood Control',
    lat: 9.882,
    lng: 123.595,
    tone: 'default',
    lgu: 'Argao',
    description: 'Argao river training and slope protection works.',
  },
  {
    id: 'moalboal',
    name: 'Moalboal Coastal Tourism Road',
    lat: 9.941,
    lng: 123.396,
    tone: 'default',
    lgu: 'Moalboal',
    description: 'Panagsama beach drainage and seawall reinforcement.',
  },
  {
    id: 'bantayan',
    name: 'Bantayan Island Shore Protection',
    lat: 11.167,
    lng: 123.722,
    tone: 'default',
    lgu: 'Bantayan',
    description: 'Island ring road widening and storm surge breakwater.',
  },
];

export function getPinsByLgu(lguName: string): Pin[] {
  const target = normalizeLguName(lguName).toLowerCase();
  return pins.filter(
    (pin) =>
      normalizeLguName(pin.lgu).toLowerCase() === target ||
      pin.name.toLowerCase().includes(target),
  );
}

export function getPinById(id: string): Pin | undefined {
  return pins.find((pin) => pin.id === id);
}

export const initialPins = pins;
