import {
  Route,
  Routes,
} from 'react-router'

import { CartProvider } from '@/context/CartContext'
import { SignInModalProvider } from '@/context/SignInModalContext'

import BrowseLayout from '@/layouts/BrowseLayout'
import MainLayout from '@/layouts/MainLayout'

import AccountPage from '@/pages/AccountPage'
import BrowsePage from '@/pages/BrowsePage'
import ComparePage from '@/pages/ComparePage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProductPage from '@/pages/ProductPage'
import SearchResultsPage from '@/pages/SearchResultsPage'

function App() {
  return (
    <CartProvider>
      <SignInModalProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route
              index
              element={<HomePage />}
            />

            <Route
              element={<BrowseLayout />}
            >
              <Route
                path="browse"
                element={<BrowsePage />}
              />
            </Route>

            <Route
              path="compare"
              element={<ComparePage />}
            />

            {/* NEW */}
            <Route
              path="search"
              element={
                <SearchResultsPage />
              }
            />

            {/* NEW */}
            <Route
              path="product/:productId"
              element={<ProductPage />}
            />

            <Route
              path="account"
              element={<AccountPage />}
            />

            <Route
              path="*"
              element={<NotFoundPage />}
            />
          </Route>
        </Routes>
      </SignInModalProvider>
    </CartProvider>
  )
}

export default App