import React from "react"
import { useLocation, Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  ChevronDown,
  LogOut,
  UserCheck,
  Shield,
  Bell,
  HelpCircle,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { sidebarNavGroups } from "@/constants/nav-items"

export function AppSidebar({ ...props }) {
  const location = useLocation()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  const currentUser = {
    name: "Dr. Eleanor Vance",
    email: "e.vance@school-lms.edu",
    role: "Head of Academics",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    initials: "EV",
  }

  const isRouteActive = (url) => {
    if (url === "/") {
      return location.pathname === "/"
    }
    return location.pathname.startsWith(url)
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar" {...props}>
      {/* Sidebar Header */}
      <SidebarHeader className="p-4 border-b border-sidebar-border/60">
        <Link to="/" className="flex items-center gap-2.5 w-full group-data-[collapsible=icon]:justify-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
            <Sparkles className="size-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden text-left">
              <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                Apex Academy
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                LMS Enterprise v2.4
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Sidebar Content (Iterated dynamically from sidebarNavGroups) */}
      <SidebarContent className="gap-2 p-2 group-data-[collapsible=icon]:p-1">
        {sidebarNavGroups.map((group) => (
          <SidebarGroup key={group.id}>
            {group.label && (
              <SidebarGroupLabel className="px-2 text-[11px] font-medium text-muted-foreground/80 tracking-wider uppercase">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isRouteActive(item.url)
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          "w-full group-data-[collapsible=icon]:justify-center",
                          active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : ""
                        )}
                      >
                        <Link
                          to={item.url}
                          className="flex size-full items-center gap-2 group-data-[collapsible=icon]:justify-center"
                        >
                          <item.icon className="size-4 shrink-0" />
                          {!isCollapsed && <span>{item.title}</span>}
                          {item.badge && !isCollapsed && (
                            <SidebarMenuBadge className="bg-primary/10 text-primary border border-primary/20 text-[10px] px-1.5 py-0.5 ml-auto">
                              {item.badge}
                            </SidebarMenuBadge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Sidebar Footer with User Profile Dropdown */}
      <SidebarFooter className="p-2 border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenuTrigger className="w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                size="lg"
                className="w-full justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="size-8 rounded-lg shrink-0">
                  <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                    {currentUser.initials}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="grid flex-1 text-left text-xs leading-tight ml-1">
                    <span className="truncate font-semibold text-sidebar-foreground">
                      {currentUser.name}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {currentUser.role}
                    </span>
                  </div>
                )}
                {!isCollapsed && <ChevronDown className="ml-auto size-4 text-muted-foreground" />}
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenu className="w-60" placement="top start">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                        {currentUser.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-0.5 leading-none">
                      <p className="font-medium text-sm text-foreground">{currentUser.name}</p>
                      <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer gap-2 py-1.5">
                  <UserCheck className="size-4 text-muted-foreground" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2 py-1.5">
                  <Bell className="size-4 text-muted-foreground" />
                  <span>Notification Center</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2 py-1.5">
                  <Shield className="size-4 text-muted-foreground" />
                  <span>Role & Permissions</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2 py-1.5">
                  <HelpCircle className="size-4 text-muted-foreground" />
                  <span>Help & Documentation</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2 py-1.5 text-destructive focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="size-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
