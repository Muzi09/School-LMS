import React, { useState } from "react"
import {
  Search,
  Filter,
  UserPlus,
  MoreHorizontal,
  Mail,
  FileSpreadsheet,
  Download,
  GraduationCap,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle
} from "lucide-react"

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/common/PageHeader"

const studentsData = [
  {
    id: "STU-2026-081",
    name: "Maya Lin",
    email: "maya.lin@student.edu",
    grade: "Grade 12",
    major: "STEM / Pre-Engineering",
    gpa: "3.95",
    attendance: "98.5%",
    status: "Honors",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
    initials: "ML",
  },
  {
    id: "STU-2026-042",
    name: "Alex Rivera",
    email: "a.rivera@student.edu",
    grade: "Grade 11",
    major: "Computer Science",
    gpa: "3.82",
    attendance: "96.0%",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80",
    initials: "AR",
  },
  {
    id: "STU-2026-105",
    name: "Sophie Zhang",
    email: "sophie.z@student.edu",
    grade: "Grade 12",
    major: "Biomedical Sciences",
    gpa: "4.00",
    attendance: "99.2%",
    status: "Honors",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&auto=format&fit=crop&q=80",
    initials: "SZ",
  },
  {
    id: "STU-2026-219",
    name: "Liam O'Connor",
    email: "liam.oc@student.edu",
    grade: "Grade 10",
    major: "Humanities & Law",
    gpa: "3.45",
    attendance: "94.8%",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    initials: "LO",
  },
  {
    id: "STU-2026-312",
    name: "Chloe Dubois",
    email: "c.dubois@student.edu",
    grade: "Grade 11",
    major: "Fine Arts & Design",
    gpa: "3.78",
    attendance: "95.5%",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    initials: "CD",
  },
  {
    id: "STU-2026-118",
    name: "Devon Brooks",
    email: "d.brooks@student.edu",
    grade: "Grade 10",
    major: "Business & Economics",
    gpa: "2.85",
    attendance: "89.0%",
    status: "Academic Review",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    initials: "DB",
  },
]

export function StudentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("All")

  const filteredStudents = studentsData.filter((stu) => {
    const matchesSearch =
      stu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stu.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stu.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stu.major.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesGrade = selectedGrade === "All" || stu.grade === selectedGrade
    return matchesSearch && matchesGrade
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader>
        <Button variant="outline" size="sm" className="gap-1.5 shadow-xs">
          <Download className="size-4" />
          <span>Export Roster</span>
        </Button>
        <Button size="sm" className="gap-1.5 shadow-xs">
          <UserPlus className="size-4" />
          <span>Enroll Student</span>
        </Button>
      </PageHeader>

      {/* Directory Filter Card */}
      <Card className="border border-border/80 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by student name, ID, or major..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {["All", "Grade 10", "Grade 11", "Grade 12"].map((grade) => (
              <Button
                key={grade}
                variant={selectedGrade === grade ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGrade(grade)}
                className="text-xs h-8 px-3 rounded-lg"
              >
                {grade}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border border-border/80 shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-80">Student</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Grade & Major</TableHead>
              <TableHead>GPA</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((stu) => (
              <TableRow key={stu.id} className="hover:bg-muted/30">
                {/* Student Info */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 rounded-full">
                      <AvatarImage src={stu.avatar} alt={stu.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                        {stu.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-foreground">{stu.name}</span>
                      <span className="text-xs text-muted-foreground">{stu.email}</span>
                    </div>
                  </div>
                </TableCell>

                {/* ID */}
                <TableCell>
                  <span className="font-mono text-xs font-medium text-muted-foreground">
                    {stu.id}
                  </span>
                </TableCell>

                {/* Grade & Major */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-xs text-foreground">{stu.grade}</span>
                    <span className="text-[11px] text-muted-foreground">{stu.major}</span>
                  </div>
                </TableCell>

                {/* GPA */}
                <TableCell>
                  <span className="font-semibold text-xs text-foreground">
                    {stu.gpa} / 4.0
                  </span>
                </TableCell>

                {/* Attendance */}
                <TableCell>
                  <span className="text-xs text-foreground font-medium">{stu.attendance}</span>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant={
                      stu.status === "Honors"
                        ? "default"
                        : stu.status === "Active"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-[11px]"
                  >
                    {stu.status}
                  </Badge>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <DropdownMenuTrigger>
                    <Button variant="ghost" size="sm" className="size-8 p-0">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenu className="w-48" placement="bottom end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem className="cursor-pointer text-xs">
                        View Complete Transcript
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-xs">
                        Edit Academic Records
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-xs">
                        Send Parent Notification
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer text-xs text-destructive">
                      Flag Academic Probation
                    </DropdownMenuItem>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
export default StudentsPage
