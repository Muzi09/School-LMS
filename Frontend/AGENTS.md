# UI Development Guidelines

## Stack

This project uses:

* React
* JavaScript
* Tailwind CSS
* shadcn/ui
* Radix UI primitives where used by shadcn/ui
* Lucide React for icons

## shadcn/ui Rules

Use shadcn/ui components as the default UI building blocks.

Before creating a custom UI component, check whether an appropriate shadcn/ui component already exists.

Install it using proper npx command if required 

Prefer composing existing shadcn components rather than recreating their behavior.

Examples:

* Buttons → `Button`
* Inputs → `Input`
* Select/dropdowns → `Select`
* Checkboxes → `Checkbox`
* Radio controls → `RadioGroup`
* Dialogs/modals → `Dialog`
* Confirmation dialogs → `AlertDialog`
* Dropdown menus → `DropdownMenu`
* Tabs → `Tabs`
* Tooltips → `Tooltip`
* Popovers → `Popover`
* Cards → `Card`
* Tables → `Table`
* Forms → shadcn form components
* Badges/status → `Badge`
* Toast/notifications → project-approved shadcn notification component
* Loading states → `Skeleton`
* Navigation → shadcn navigation components where appropriate

## Component Usage

Always inspect the existing component implementation in:

`src/components/ui/`

before using or modifying a shadcn component.

Do not assume component APIs from memory if the local implementation is available.

Use the props supported by the installed version of the component.

Example:

```jsx
import { Button } from "@/components/ui/button"

<Button variant="outline" size="sm">
  Cancel
</Button>
```

## Styling

Use Tailwind CSS for styling.

Prefer:

```jsx
className="flex items-center gap-2 rounded-md border p-4"
```

over creating separate CSS files for simple component styling.

Use existing design tokens and CSS variables when available.

Do not introduce arbitrary colors when the design system already provides semantic tokens such as:

* `bg-background`
* `bg-card`
* `bg-primary`
* `bg-muted`
* `text-foreground`
* `text-muted-foreground`
* `border-border`

Prefer semantic Tailwind classes over hard-coded colors.

## Responsive Design

All UI must be responsive.

Use Tailwind breakpoints rather than JavaScript viewport detection whenever possible.

Example:

```jsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
```

## Icons

Use Lucide React icons when an icon is required.

Do not use manually drawn SVG icons unless specifically required.

## Accessibility

Use semantic HTML and shadcn/Radix accessibility primitives.

Do not remove accessibility-related props or behavior from shadcn components.

Interactive elements must be keyboard accessible.

Inputs, dialogs, menus, dropdowns, and other interactive controls should use their shadcn/Radix implementations rather than custom implementations.

## Reuse

Before creating a new component:

1. Check `src/components/ui/`.
2. Check existing application components.
3. Reuse or compose an existing component if possible.
4. Only create a new component when the existing components cannot reasonably satisfy the requirement.

## Component Modification

Do not modify shadcn/ui source components globally just to satisfy one screen.

Prefer composing the component and overriding styling through supported props/className.

If a global modification is genuinely required, explain why before making it.

## UI Quality

When implementing a design:

* Match spacing consistently.
* Use a clear visual hierarchy.
* Use shadcn variants instead of inventing duplicate variants.
* Avoid unnecessary borders and shadows.
* Keep forms compact and readable.
* Use consistent typography.
* Use appropriate empty, loading, error, and disabled states.
* Do not create visually inconsistent one-off components.

## Important

The installed code is the source of truth for component APIs.

Do not assume that an API from an older/newer shadcn example exists in this project.

Inspect the local component before implementation.
