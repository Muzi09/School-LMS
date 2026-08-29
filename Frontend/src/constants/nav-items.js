import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  GraduationCap,
  Briefcase,
  FileCheck2,
  Award,
  Clock,
  BarChart3,
  ShieldCheck,
} from "lucide-react"

export const sidebarNavGroups = [
  // {
  //   id: "overview",
  //   label: "Overview",
  //   items: [
  //     {
  //       title: "Dashboard",
  //       description: "Welcome back to Apex Academy LMS. Overview of academic sessions and attendance.",
  //       url: "/",
  //       icon: LayoutDashboard,
  //     },
  //     {
  //       title: "Courses",
  //       description: "Explore curriculum catalogs, student enrollments, and syllabus milestones.",
  //       url: "/courses",
  //       icon: BookOpen,
  //     },
  //     {
  //       title: "Calendar",
  //       description: "View and manage daily class schedules, lecture halls, and timetables.",
  //       url: "/schedule",
  //       icon: Calendar,
  //     },
  //   ],
  // },
  {
    id: "management",
    label: "User Management",
    items: [
      {
        title: "Manage Staff",
        description: "Manage teaching and administrative staff, credentials, and staff profiles.",
        url: "/staff",
        icon: Briefcase,
      },
      {
        title: "Manage Students",
        description: "Register students, academic placement, sections, and guardian contact details.",
        url: "/students",
        icon: GraduationCap,
      },
    ],
  },
  // {
  //   id: "academic",
  //   label: "Academic Suite",
  //   items: [
  //     {
  //       title: "Assignments",
  //       description: "Create, distribute, and grade assignments across active course sections.",
  //       url: "/assignments",
  //       icon: FileCheck2,
  //     },
  //     {
  //       title: "Gradebook",
  //       description: "Track student academic performance, grading thresholds, and term scores.",
  //       url: "/gradebook",
  //       icon: Award,
  //     },
  //     {
  //       title: "Attendance",
  //       description: "Daily attendance tracking, check-in rate records, and leave management.",
  //       url: "/attendance",
  //       icon: Clock,
  //     },
  //   ],
  // },
  // {
  //   id: "admin",
  //   label: "Administration",
  //   items: [
  //     {
  //       title: "Analytics & Reports",
  //       description: "Institutional performance metrics, enrollment trends, and reporting.",
  //       url: "/analytics",
  //       icon: BarChart3,
  //     },
  //     {
  //       title: "User Permissions",
  //       description: "Configure role-based access control, security policies, and permissions.",
  //       url: "/permissions",
  //       icon: ShieldCheck,
  //     },
  //   ],
  // },
]

export function getRouteMeta(pathname) {
  for (const group of sidebarNavGroups) {
    const item = group.items.find((i) => {
      if (i.url === "/") return pathname === "/"
      return pathname === i.url || pathname.startsWith(`${i.url}/`)
    })
    if (item) {
      return {
        groupLabel: group.label,
        title: item.title,
        description: item.description,
        icon: item.icon,
      }
    }
  }

  return {
    groupLabel: "Overview",
    title: "School LMS",
    description: "Enterprise Academic Management System",
  }
}
