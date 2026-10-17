import { RouterProvider } from 'react-router/dom'
import { createBrowserRouter } from 'react-router'
import type { RouteObject } from 'react-router'

import { Layout } from './components/Layout'
import { LocaleProvider } from './i18n/context.js'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        lazy: async () => ({ Component: (await import('./pages/Home.js')).Home }),
      },
      {
        path: '/order',
        lazy: async () => ({ Component: (await import('./pages/Order.js')).Order }),
      },
      {
        path: '/orders/:token',
        lazy: async () => ({ Component: (await import('./pages/OrderStatus.js')).OrderStatus }),
      },
      {
        path: '/track',
        lazy: async () => ({ Component: (await import('./pages/Track.js')).Track }),
      },
      {
        path: '/help',
        lazy: async () => ({ Component: (await import('./pages/Help.js')).Help }),
      },
      {
        path: '/terms',
        lazy: async () => ({ Component: (await import('./pages/Terms.js')).Terms }),
      },
      {
        path: '/privacy',
        lazy: async () => ({ Component: (await import('./pages/Privacy.js')).Privacy }),
      },
    ],
  },
]

const router = createBrowserRouter(routes)

export function App () {
  return (
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  )
}
