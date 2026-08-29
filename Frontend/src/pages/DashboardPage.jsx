import React from "react"
import { Link } from "react-router-dom"
import {
  GraduationCap,
  BookOpen,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  MoreVertical,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

const stats = [
  {
    title: "Enrolled Students",
    value: "1,248",
    change: "+4.8%",
    isPositive: true,
    description: "vs. previous semester",
    icon: GraduationCap,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Active Courses",
    value: "42",
    change: "+2 new",
    isPositive: true,
    description: "across 6 academic departments",
    icon: BookOpen,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Daily Attendance",
    value: "96.4%",
    change: "+0.6%",
    isPositive: true,
    description: "average daily check-in rate",
    icon: Clock,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/10",
  },
  {
    title: "Assignments Graded",
    value: "84.2%",
    change: "-1.2%",
    isPositive: false,
    description: "32 pending review",
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
  },
]

const todayClasses = [
  {
    id: 1,
    time: "09:00 AM - 10:30 AM",
    subject: "AP Physics C: Mechanics",
    code: "PHY-301",
    room: "Lab 204",
    instructor: "Dr. Marcus Bell",
    studentsCount: 28,
    status: "Completed",
  },
  {
    id: 2,
    time: "11:00 AM - 12:30 PM",
    subject: "Advanced Linear Algebra",
    code: "MTH-402",
    room: "Hall B",
    instructor: "Prof. Sarah Chen",
    studentsCount: 34,
    status: "In Progress",
  },
  {
    id: 3,
    time: "02:00 PM - 03:30 PM",
    subject: "World Literature & Composition",
    code: "ENG-201",
    room: "Room 108",
    instructor: "Ms. Rachel Green",
    studentsCount: 30,
    status: "Upcoming",
  },
]

const recentActivities = [
  {
    id: 1,
    user: "Prof. Sarah Chen",
    action: "published grades for",
    target: "Midterm Exam - Calculus II",
    time: "25 minutes ago",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    initials: "SC",
  },
  {
    id: 2,
    user: "Alex Rivera",
    action: "submitted assignment for",
    target: "Neural Networks Lab #3",
    time: "1 hour ago",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80",
    initials: "AR",
  },
  {
    id: 3,
    user: "System Administrator",
    action: "generated term report for",
    target: "Q2 Academic Board Review",
    time: "3 hours ago",
    avatar: "",
    initials: "SA",
  },
]

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[11px] h-5">
              Semester Fall 2026
            </Badge>
            <span className="text-xs text-muted-foreground">Week 8 of 16</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Welcome back, Dr. Vance
          </h1>
          <p className="text-xs text-muted-foreground">
            Academic operations are running smoothly with 96.4% attendance across all active sessions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" render={(props) => <Link to="/schedule" {...props} />}>
            <Calendar className="size-3.5" />
            <span>View Schedule</span>
          </Button>
          <Button size="sm" className="gap-1.5 shadow-xs h-8 text-xs" render={(props) => <Link to="/students" {...props} />}>
            <UserCheck className="size-3.5" />
            <span>Manage Records</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="font-medium">{stat.title}</CardDescription>
                <div className={`p-2 rounded-xl ${stat.bgColor} ${stat.color}`}>
                  <stat.icon className="size-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-0.5 font-medium ${
                    stat.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {stat.isPositive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {stat.change}
                </span>
                <span className="text-muted-foreground">{stat.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Dashboard Content: Class Timetable & Recent Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's Classes List (2 Columns) */}
        <Card className="lg:col-span-2 border border-border shadow-xs">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Today's Academic Schedule</CardTitle>
                <CardDescription>Scheduled lectures and laboratory sessions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary" render={(props) => <Link to="/schedule" {...props} />}>
                <span>Full Timetable</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {todayClasses.map((c) => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{c.subject}</span>
                      <Badge variant="outline" className="text-[10px] font-mono font-normal">
                        {c.code}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {c.time}
                      </span>
                      <span>•</span>
                      <span>{c.room}</span>
                      <span>•</span>
                      <span>{c.instructor}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{c.studentsCount} Students</span>
                    <Badge
                      variant={
                        c.status === "In Progress"
                          ? "default"
                          : c.status === "Completed"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {c.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Feed (1 Column) */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="border-b border-border/60">
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Live updates from faculty & students</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <Avatar className="size-8 rounded-full">
                    {act.avatar && <AvatarImage src={act.avatar} alt={act.user} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {act.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5 text-xs">
                    <p className="text-foreground leading-snug">
                      <span className="font-medium">{act.user}</span>{" "}
                      <span className="text-muted-foreground">{act.action}</span>{" "}
                      <span className="font-medium text-foreground">{act.target}</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground/80">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="border-t border-border/60 p-3">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
              View Audit Log
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
export default DashboardPage
