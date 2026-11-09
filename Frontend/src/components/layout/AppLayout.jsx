import { Outlet, useLocation } from "react-router-dom"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AppHeader } from "@/components/layout/AppHeader"

export function AppLayout() {
  const location = useLocation()
  const isChat = location.pathname.startsWith("/chat")
  const isArrangement = location.pathname.startsWith("/arrangement")

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <SidebarInset
          className={`flex flex-col flex-1 min-w-0 bg-background ${
            isChat ? "h-screen overflow-hidden" : ""
          }`}
        >
          <AppHeader />
          {isChat ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
              <Outlet />
            </div>
          ) : isArrangement ? (
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden px-3 py-2 md:px-4 md:py-2.5 bg-background">
              <div className="w-full h-full flex flex-col min-h-0">
                <Outlet />
              </div>
            </main>
          ) : (
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/20 [scrollbar-gutter:stable]">
              <div className="mx-auto max-w-7xl">
                <Outlet />
              </div>
            </main>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
export default AppLayout
