function Header({ name, links }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-a5 px-6 py-4">
      <a href="/" className="text-base font-bold text-inherit no-underline">
        {name}
      </a>
      <nav aria-label="Main">
        <ul className="flex gap-5">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-inherit no-underline hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

export default Header
