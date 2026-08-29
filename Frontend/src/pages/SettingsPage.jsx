import React from "react"
import {
  Building2,
  Bell,
  ShieldCheck,
  Calendar,
  Save,
  Key,
  Users,
  CheckCircle,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/common/PageHeader"

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader />

      <Tabs defaultValue="general" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="general">School Profile</TabsTrigger>
          <TabsTrigger value="academic">Academic Terms</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Access & Security</TabsTrigger>
        </TabsList>

        {/* Tab 1: School Profile */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle>Institutional Details</CardTitle>
              <CardDescription>
                Primary identification and accreditation details for your LMS instance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Institute Legal Name</label>
                  <Input defaultValue="Apex International Academy" className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Accreditation Code</label>
                  <Input defaultValue="EDU-US-98421" className="text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Official Admin Email</label>
                  <Input defaultValue="admissions@apexacademy.edu" className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Campus Timezone</label>
                  <Input defaultValue="America/New_York (EST/EDT)" className="text-xs" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/60 p-4 flex justify-end gap-2">
              <Button variant="outline" size="sm">Reset</Button>
              <Button size="sm" className="gap-1.5">
                <Save className="size-3.5" />
                <span>Save Changes</span>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Tab 2: Academic Terms */}
        <TabsContent value="academic" className="space-y-6">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle>Academic Calendar & Term Definitions</CardTitle>
              <CardDescription>
                Manage active semesters, grading periods, and vacation schedules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">Fall 2026 Semester</span>
                    <Badge variant="default" className="text-[10px]">Active Term</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Aug 24, 2026 – Dec 18, 2026 • 16 Weeks</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs">Edit Term</Button>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">Spring 2027 Semester</span>
                    <Badge variant="secondary" className="text-[10px]">Upcoming</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Jan 11, 2027 – May 21, 2027 • 16 Weeks</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle>Automated Communications & Alerts</CardTitle>
              <CardDescription>
                Configure email and in-app triggers for faculty, students, and parents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { title: "Assignment Due Reminders", desc: "Notify students 24 hours prior to deadline", enabled: true },
                { title: "Attendance Threshold Warning", desc: "Alert guardians when student attendance falls below 90%", enabled: true },
                { title: "Quarterly Grade Reports", desc: "Automate PDF transcript emails to registered parents", enabled: false },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:bg-muted/30">
                  <div>
                    <h4 className="font-semibold text-xs text-foreground">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Badge variant={item.enabled ? "default" : "outline"} className="text-[10px]">
                    {item.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Security */}
        <TabsContent value="security" className="space-y-6">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle>Single Sign-On (SSO) & Access Control</CardTitle>
              <CardDescription>
                Enforce multi-factor authentication (MFA) and SAML / OAuth providers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-emerald-500" />
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Google Workspace SSO</h4>
                    <p className="text-xs text-muted-foreground">Connected to @apexacademy.edu domain</p>
                  </div>
                </div>
                <Badge variant="default" className="text-xs">Connected</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
export default SettingsPage
