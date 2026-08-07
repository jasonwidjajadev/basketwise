import { Outlet } from 'react-router'

import BrowsePageSidebar from '@/components/BrowsePageLeftSidebar'

export default function BrowseLayout() {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-360 px-6 lg:px-8 xl:px-10">
      <BrowsePageSidebar />

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}