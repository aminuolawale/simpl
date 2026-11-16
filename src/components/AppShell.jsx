import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SideNav from './SideNav'
import styles from './AppShell.module.css'

// null outside the shell; inside it, controls for the (mobile) nav overlay.
const ShellContext = createContext(null)
export const useShell = () => useContext(ShellContext)

// Layout for list/detail pages: side nav on the left, the page on the right.
// On narrow screens the nav becomes an overlay opened from the app bar.
// Reader pages (sessions, notes) render without it to keep the reading space.
export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const { pathname, search } = useLocation()

  useEffect(() => { setNavOpen(false) }, [pathname, search])

  return (
    <ShellContext.Provider value={{ openNav: () => setNavOpen(true) }}>
      <div className={styles.shell}>
        <SideNav open={navOpen} onClose={() => setNavOpen(false)} />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </ShellContext.Provider>
  )
}
