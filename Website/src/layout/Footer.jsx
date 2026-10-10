function Footer({ name }) {
  return (
    <footer className="border-t border-gray-a5 px-6 py-4 text-center">
      <p className="text-xs text-gray-a11">
        © {new Date().getFullYear()} {name}
      </p>
    </footer>
  )
}

export default Footer
