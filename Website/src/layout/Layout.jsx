import { navLinks, site } from '../data/site'
import Header from './Header'
import Footer from './Footer'

function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header name={site.name} links={navLinks} />
      <main className="flex-1">{children}</main>
      <Footer name={site.name} />
    </div>
  )
}

export default Layout
