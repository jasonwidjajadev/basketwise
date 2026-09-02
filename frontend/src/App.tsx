import { Route, Routes } from 'react-router'

import { CartProvider } from '@/context/CartContext'
import BrowseLayout from '@/layouts/BrowseLayout'
import MainLayout from '@/layouts/MainLayout'

import AccountPage from '@/pages/AccountPage'
import BrowsePage from '@/pages/BrowsePage'
import CategoriesPage from '@/pages/CategoriesPage'
import ComparePage from '@/pages/ComparePage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import SignInPage from '@/pages/SignInPage'

function App() {
  return (
    <CartProvider>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />

          <Route path="categories" element={<CategoriesPage />} />

          <Route element={<BrowseLayout />}>
            <Route path="browse" element={<BrowsePage />} />
          </Route>

          <Route path="compare" element={<ComparePage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="signin" element={<SignInPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </CartProvider>
  )
}

export default App
