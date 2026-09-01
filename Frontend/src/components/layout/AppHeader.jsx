import React, { useState } from "react"
import { useLocation, Link } from "react-router-dom"
import {
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  BookPlus,
  UserPlus,
  FilePlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  LogOut,
} from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useTheme } from "@/context/ThemeContext"
import { useAuth } from "@/context/AuthContext"
import { getRouteMeta } from "@/constants/nav-items"

export function AppHeader() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")

  const currentRouteInfo = getRouteMeta(location.pathname)

  const notifications = [
    {
      id: 1,
      title: "New Student Enrollment",
      desc: "Maya Lin registered for AP Physics C",
      time: "10m ago",
      type: "success",
      icon: CheckCircle2,
    },
    {
      id: 2,
      title: "Assignment Due Today",
      desc: "Linear Algebra - Problem Set #4 at 5:00 PM",
      time: "1h ago",
      type: "warning",
      icon: Clock,
    },
    {
      id: 3,
      title: "Faculty Meeting",
      desc: "Quarterly review in Conference Room A",
      time: "3h ago",
      type: "info",
      icon: AlertCircle,
    },
  ]

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md transition-[width,height] ease-linear">
      {/* Left Area: Sidebar Trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />

        <Breadcrumb>
          <BreadcrumbList>
            {currentRouteInfo.groupLabel && (
              <BreadcrumbItem className="hidden md:inline-flex">
                <span className="text-sm text-muted-foreground font-medium">
                  {currentRouteInfo.groupLabel}
                </span>
              </BreadcrumbItem>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className=" text-sm text-foreground">
                {currentRouteInfo.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right Area: Search, Quick Actions, Theme, Notifications, Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Global Search Bar */}
        <div className="relative hidden md:flex items-center w-64 lg:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search courses, students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 pr-12 text-xs bg-muted/40 focus:bg-background rounded-lg border-border"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </div>

        {/* Quick Add Action Dropdown */}
        <DropdownMenuTrigger>
          <Button
            size="sm"
            variant="outline"
            className="hidden sm:flex items-center gap-1.5 h-9 rounded-lg border-border bg-background font-medium text-xs shadow-xs hover:bg-muted"
          >
            <Plus className="size-4 text-primary" />
            <span>Create</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenu className="w-52" placement="bottom end">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold">
              Quick Scaffolding
            </DropdownMenuLabel>
            <DropdownMenuItem className="cursor-pointer gap-2 text-xs">
              <BookPlus className="size-4 text-blue-500" />
              <span>New Course Section</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2 text-xs">
              <UserPlus className="size-4 text-emerald-500" />
              <span>Enroll Student</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2 text-xs">
              <FilePlus className="size-4 text-purple-500" />
              <span>Publish Assignment</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenu>

        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="size-9 p-0 rounded-lg text-muted-foreground hover:text-foreground"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4 text-amber-400" />
          ) : (
            <Moon className="size-4 text-slate-700" />
          )}
        </Button>

        {/* Notification Center */}
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="relative size-9 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenu className="w-80 p-2" placement="bottom end">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <Badge variant="secondary" className="text-[10px] h-5">
              3 New
            </Badge>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-muted/80"
              >
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <n.icon className="size-3.5" />
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <p className="text-xs font-medium text-foreground leading-tight">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{n.desc}</p>
                  <span className="text-[10px] text-muted-foreground/70">{n.time}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <div className="p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-primary hover:text-primary font-medium h-7"
            >
              View all notifications
            </Button>
          </div>
        </DropdownMenu>

        <Separator orientation="vertical" className="hidden sm:block h-5 mx-1" />

        {/* User Profile & Logout */}
        <DropdownMenuTrigger>
          <button
            type="button"
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <Avatar className="size-8 rounded-full ring-2 ring-primary/20">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {user?.first_name?.[0] || "U"}{user?.last_name?.[0] || ""}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-foreground leading-tight">
                {user ? `${user.first_name} ${user.last_name}` : "User"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {user?.school_name || (user?.role === 1 ? "Principal" : "Staff")}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenu className="w-56 p-1.5" placement="bottom end">
          <div className="px-2 py-1.5 border-b border-border mb-1">
            <p className="text-xs font-semibold text-foreground">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            {user?.school_name && (
              <p className="text-[10px] font-medium text-primary mt-0.5">{user.school_name}</p>
            )}
          </div>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                logout()
                window.location.href = "/principal/login"
              }}
              className="cursor-pointer gap-2 text-xs text-destructive hover:text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenu>
      </div>
    </header>
  )
}
