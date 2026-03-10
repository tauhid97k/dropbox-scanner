import { Link } from '@tanstack/react-router'

const Navbar = () => {
  return (
    <nav className="border-b py-3 dark:bg-card">
      <div className="container flex items-center justify-between gap-4">
        <Link to="/" className="shrink-0">
          <img src="/logo.png" alt="Brand Logo" width={120} />
        </Link>
        <div className="flex items-center gap-4">
          {/* Theme Switcher Here */}
          <Link to="/auth/sign-in">Sign In</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
