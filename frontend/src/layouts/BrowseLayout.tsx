import { Outlet } from 'react-router'

import BrowsePageSidebar from '@/components/BrowsePageLeftSidebar'

export default function BrowseLayout() {
  return (
    <div className="flex min-h-[calc(100svh-4rem)]">
      <BrowsePageSidebar />

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}