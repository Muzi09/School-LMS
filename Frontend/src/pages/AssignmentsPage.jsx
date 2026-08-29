import React, { useState } from "react"
import {
  FileCheck2,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Users,
  Search,
  ChevronRight,
  BookOpen
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/common/PageHeader"

const assignmentsData = [
  {
    id: "ASG-101",
    title: "Quantum Mechanics Problem Set #4",
    course: "AP Physics C",
    courseCode: "PHY-301",
    dueDate: "Today, 11:59 PM",
    submissions: 24,
    totalStudents: 28,
    status: "Due Soon",
    weight: "15% of Grade",
    type: "Problem Set",
  },
  {
    id: "ASG-102",
    title: "Comparative Essay: Modernist Poetry",
    course: "World Literature",
    courseCode: "ENG-201",
    dueDate: "Tomorrow, 5:00 PM",
    submissions: 18,
    totalStudents: 30,
    status: "Active",
    weight: "20% of Grade",
    type: "Essay",
  },
  {
    id: "ASG-103",
    title: "Eigenvalues & Diagonalization Project",
    course: "Advanced Linear Algebra",
    courseCode: "MTH-402",
    dueDate: "Sept 3, 2026",
    submissions: 34,
    totalStudents: 34,
    status: "Needs Grading",
    weight: "25% of Grade",
    type: "Lab Project",
  },
  {
    id: "ASG-104",
    title: "Object Oriented Design in Python",
    course: "Intro to CS",
    courseCode: "CS-101",
    dueDate: "Sept 5, 2026",
    submissions: 12,
    totalStudents: 42,
    status: "Active",
    weight: "10% of Grade",
    type: "Programming",
  },
]

export function AssignmentsPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const filtered = assignmentsData.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.course.toLowerCase().includes(searchTerm.toLowerCase())

    if (activeTab === "all") return matchesSearch
    if (activeTab === "due-soon") return matchesSearch && a.status === "Due Soon"
    if (activeTab === "grading") return matchesSearch && a.status === "Needs Grading"
    return matchesSearch
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader>
        <Button className="gap-2 shadow-xs">
          <Plus className="size-4" />
          <span>New Assignment</span>
        </Button>
      </PageHeader>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search assignments or courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="all">All Assignments</TabsTrigger>
            <TabsTrigger value="due-soon">Due Soon</TabsTrigger>
            <TabsTrigger value="grading">Needs Grading</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Assignments List */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((item) => {
          const submissionPercentage = Math.round((item.submissions / item.totalStudents) * 100)
          return (
            <Card key={item.id} className="border border-border/80 shadow-xs hover:border-primary/40 transition-all">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs font-medium">
                      {item.courseCode}
                    </Badge>
                    <Badge
                      variant={
                        item.status === "Due Soon"
                          ? "destructive"
                          : item.status === "Needs Grading"
                          ? "default"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {item.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">• {item.weight}</span>
                  </div>

                  <h3 className="text-base font-bold text-foreground">{item.title}</h3>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <BookOpen className="size-3.5 text-primary" />
                      {item.course}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      Due: {item.dueDate}
                    </span>
                  </div>
                </div>

                {/* Submissions & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-40 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Turned In</span>
                      <span className="font-semibold text-foreground">
                        {item.submissions}/{item.totalStudents} ({submissionPercentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${submissionPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs">
                      Edit
                    </Button>
                    <Button size="sm" className="text-xs shadow-xs">
                      Review Submissions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
export default AssignmentsPage
