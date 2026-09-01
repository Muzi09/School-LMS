/**
 * Utilities for Dynamic Multi-Tenant School Theming
 */

export function hexToRgb(hex) {
  if (!hex) return null
  let cleanHex = hex.replace("#", "").trim()
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("")
  }
  if (cleanHex.length !== 6) return null

  const num = parseInt(cleanHex, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

/**
 * Calculate appropriate text color (white or dark slate) for high contrast readability
 * using WCAG relative luminance formula.
 */
export function getContrastTextColor(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#ffffff"

  // Relative luminance calculation
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.58 ? "#0f172a" : "#ffffff"
}

/**
 * Apply dynamic school primary color to document root CSS tokens.
 */
export function applySchoolTheme(primaryHex) {
  if (typeof window === "undefined" || !document?.documentElement) return

  if (!primaryHex || !/^#[0-9A-Fa-f]{3,6}$/.test(primaryHex)) {
    resetSchoolTheme()
    return
  }

  const root = document.documentElement
  const textColor = getContrastTextColor(primaryHex)
  const rgb = hexToRgb(primaryHex)

  // Apply custom design tokens
  root.style.setProperty("--primary", primaryHex)
  root.style.setProperty("--primary-foreground", textColor)
  root.style.setProperty("--sidebar-primary", primaryHex)
  root.style.setProperty("--sidebar-primary-foreground", textColor)
  root.style.setProperty("--ring", primaryHex)

  if (rgb) {
    // Subtle accent/hover backgrounds (12% opacity)
    root.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`)
    root.style.setProperty(
      "--sidebar-accent",
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`
    )
  }
}

/**
 * Remove all inline theme overrides and revert to base stylesheet theme.
 */
export function resetSchoolTheme() {
  if (typeof window === "undefined" || !document?.documentElement) return

  const root = document.documentElement
  root.style.removeProperty("--primary")
  root.style.removeProperty("--primary-foreground")
  root.style.removeProperty("--sidebar-primary")
  root.style.removeProperty("--sidebar-primary-foreground")
  root.style.removeProperty("--ring")
  root.style.removeProperty("--primary-rgb")
  root.style.removeProperty("--sidebar-accent")
}
