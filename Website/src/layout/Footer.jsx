function Footer({ name }) {
  return (
    <footer className="border-t border-gray-a5 px-6 py-4 text-center">
      <p className="text-xs text-gray-a11">
        © {new Date().getFullYear()} {name}
      </p>
      <p className="text-[10px] text-gray-a10">
        Municipal boundaries from{' '}
        <a
          href="https://www.geoboundaries.org"
          target="_blank"
          rel="noreferrer"
          className="text-accent-a11 hover:underline"
        >
          geoBoundaries
        </a>{' '}
        (NAMRIA/PSA), CC BY 4.0 · Map by{' '}
        <a
          href="https://leafletjs.com"
          target="_blank"
          rel="noreferrer"
          className="text-accent-a11 hover:underline"
        >
          Leaflet
        </a>
      </p>
    </footer>
  )
}

export default Footer
