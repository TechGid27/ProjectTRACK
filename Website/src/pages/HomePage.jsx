import Layout from '../layout/Layout'
import CebuMap from '../features/map/CebuMap'
import { pins } from '../data/pins'
import municipalities from '../assets/cebuMunicipalities.json'

const CITY_RE = /^(City of |.* City$)/

function HomePage() {
  const names = municipalities.features.map((f) => f.properties.name)
  const cities = names.filter((n) => CITY_RE.test(n)).length
  const townCount = names.length - cities

  return (
    <Layout>
      <CebuMap />
      <section className="border-t border-gray-a5">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <h2 className="font-serif text-3xl text-gray-a12">Cebu, in text</h2>
          <p className="mt-4 text-base leading-7 text-gray-a11">
            ProjectTRACK maps public works and infrastructure projects across
            Cebu Province. The map above is interactive — each glowing pin is a
            tracked project site. The pages below present the same material as
            plain text, one page per municipality.
          </p>
          <p className="mt-5 text-sm text-gray-a10">
            {names.length} LGUs · {pins.length} project sites · {cities}{' '}
            cities · {townCount} municipalities
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#municipalities"
              className="rounded-xl bg-[#1f3d3c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#16302f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
            >
              Browse by municipality
            </a>
            <a
              href="#about"
              className="rounded-xl border border-[#1f3d3c] px-6 py-3 text-sm font-semibold text-[#1f3d3c] transition hover:bg-[#1f3d3c]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
            >
              About the map
            </a>
          </div>
        </div>
      </section>
    </Layout>
  )
}

export default HomePage
