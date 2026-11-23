import { Layers, BookOpen } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export function AssignmentTabs({groupPanel, preferGroup, busy, children}) {
  if (!groupPanel) return children
  return <Tabs defaultSelectedKey={preferGroup ? "group" : "individual"} isDisabled={busy}
    className="min-h-0 gap-0 overflow-hidden">
    <TabsList aria-label="Assignment type" className="mx-5 my-3 shrink-0">
      <TabsTrigger id="individual" className="px-4"><BookOpen />Individual</TabsTrigger>
      <TabsTrigger id="group" className="px-4"><Layers />Group</TabsTrigger>
    </TabsList>
    <TabsContent id="individual" className="flex min-h-0 flex-col overflow-y-auto">{children}</TabsContent>
    <TabsContent id="group" className="min-h-0 overflow-y-auto px-5 pb-5">{() => groupPanel()}</TabsContent>
  </Tabs>
}
