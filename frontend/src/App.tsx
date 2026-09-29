import { BrowserRouter } from 'react-router-dom'

import { AppRoutes } from '@/routes/AppRoutes'

/**
 * The application root.
 *
 * Sprint 1-B shipped a temporary harness page here so the component library and
 * the console shell could be checked in a browser before any route existed.
 * Sprint 1-C replaces it with the real tree; the harness is gone.
 */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
