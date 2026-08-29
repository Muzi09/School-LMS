import React, { useState } from "react"
import {
  BookOpen,
  Search,
  Plus,
  Users,
  Clock,
  CheckCircle,
  MoreVertical,
  Layers,
  GraduationCap,
  ExternalLink,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/common/PageHeader"

const coursesData = [
  {
    id: "cs-101",
    title: "Introduction to Computer Science & Python",
    code: "CS-101",
    department: "STEM",
    instructor: "Dr. Alan Turing",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    enrolled: 42,
    capacity: 45,
    progress: 68,
    schedule: "Mon, Wed, Fri • 10:00 AM",
    room: "Lab 3B",
  },
  {
    id: "phy-301",
    title: "AP Physics C: Classical Mechanics",
    code: "PHY-301",
    department: "Advanced Placement",
    instructor: "Dr. Marcus Bell",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    enrolled: 28,
    capacity: 30,
    progress: 75,
    schedule: "Tue, Thu • 09:00 AM",
    room: "Science Hall 1",
  },
  {
    id: "mth-402",
    title: "Advanced Linear Algebra & Matrix Theory",
    code: "MTH-402",
    department: "STEM",
    instructor: "Prof. Sarah Chen",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    enrolled: 34,
    capacity: 35,
    progress: 82,
    schedule: "Mon, Wed • 11:00 AM",
    room: "Room 204",
  },
  {
    id: "eng-201",
    title: "World Literature & Critical Composition",
    code: "ENG-201",
    department: "Humanities",
    instructor: "Ms. Rachel Green",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
    enrolled: 30,
    capacity: 32,
    progress: 55,
    schedule: "Tue, Thu • 02:00 PM",
    room: "Library Room 4",
  },
  {
    id: "bio-205",
    title: "Cellular Biology & Molecular Genetics",
    code: "BIO-205",
    department: "STEM",
    instructor: "Dr. Evelyn Reed",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
    enrolled: 26,
    capacity: 30,
    progress: 60,
    schedule: "Mon, Fri • 01:00 PM",
    room: "BioLab 102",
  },
  {
    id: "his-108",
    title: "Modern European & Diplomatic History",
    code: "HIS-108",
    department: "Humanities",
    instructor: "Mr. Gregory House",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80",
    enrolled: 38,
    capacity: 40,
    progress: 40,
    schedule: "Wed, Fri • 09:30 AM",
    room: "Lecture Hall A",
  },
]

export function CoursesPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredCourses = coursesData.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.instructor.toLowerCase().includes(searchTerm.toLowerCase())

    if (activeTab === "all") return matchesSearch
    if (activeTab === "stem") return matchesSearch && c.department === "STEM"
    if (activeTab === "humanities") return matchesSearch && c.department === "Humanities"
    if (activeTab === "ap") return matchesSearch && c.department === "Advanced Placement"
    return matchesSearch
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Actions */}
      <PageHeader>
        <Button className="gap-2 shadow-xs">
          <Plus className="size-4" />
          <span>New Course</span>
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-80">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search course title, code or instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="all">All ({coursesData.length})</TabsTrigger>
            <TabsTrigger value="stem">STEM</TabsTrigger>
            <TabsTrigger value="humanities">Humanities</TabsTrigger>
            <TabsTrigger value="ap">AP Honors</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCourses.map((course) => (
          <Card key={course.id} className="flex flex-col justify-between border border-border/80 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <Badge
                  variant={
                    course.department === "Advanced Placement"
                      ? "default"
                      : course.department === "STEM"
                      ? "secondary"
                      : "outline"
                  }
                  className="text-[11px]"
                >
                  {course.department}
                </Badge>
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {course.code}
                </span>
              </div>
              <CardTitle className="text-base font-bold line-clamp-2 mt-2">
                {course.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {course.schedule} • {course.room}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              {/* Instructor information */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/40">
                <Avatar className="size-8 rounded-full">
                  <AvatarImage src={course.avatar} alt={course.instructor} />
                  <AvatarFallback className="text-xs">{course.instructor[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {course.instructor}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Faculty Lead</span>
                </div>
              </div>

              {/* Progress & Enrollment */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Syllabus Progress</span>
                  <span className="font-semibold text-foreground">{course.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {course.enrolled} / {course.capacity} Students
                  </span>
                  <span>{course.capacity - course.enrolled} seats open</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border/60 p-3 pt-3 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" className="w-full text-xs font-medium">
                Roster
              </Button>
              <Button size="sm" className="w-full text-xs font-medium">
                Manage Class
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default CoursesPage
