---
description: Strict UI component guidelines and mandatory shadcn design system usage
globs: Frontend/src/**/*.{jsx,tsx,js,ts}
---

# UI Component & Design System Standards

## Mandatory Shadcn Component Usage
1. **Always Use Shadcn Primitives**:
   - **Data Tables**: ALWAYS use `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` from `@/components/ui/table`. NEVER write raw HTML `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` with ad-hoc classes.
   - **Buttons & Links**: ALWAYS use `Button` from `@/components/ui/button`.
   - **Inputs & Fields**: ALWAYS use `Input` from `@/components/ui/input`.
   - **Date Pickers**: ALWAYS use `DatePicker` from `@/components/ui/date-picker`.
   - **Badges & Status**: ALWAYS use `Badge` from `@/components/ui/badge`.
   - **Modals & Dialogs**: ALWAYS use `Dialog` primitives from `@/components/ui/dialog`.
   - **Dropdowns & Menus**: ALWAYS use `DropdownMenu` primitives from `@/components/ui/dropdown-menu`.
   - **Cards & Surfaces**: ALWAYS use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` from `@/components/ui/card`.
   - **Avatars**: ALWAYS use `Avatar`, `AvatarImage`, `AvatarFallback` from `@/components/ui/avatar`.

2. **Check Before Writing**:
   - Before implementing any UI feature, check `@/components/ui/` for existing components.
   - If a required shadcn component is missing, create it in `@/components/ui/` following the existing aria-rhea / shadcn token structure.

3. **No Ad-Hoc HTML Equivalents**:
   - Never fallback to raw generic HTML elements when an established `@/components/ui/*` component exists.
   - Maintain uniform enterprise density, rounded tokens, and theme responsiveness across all pages.
