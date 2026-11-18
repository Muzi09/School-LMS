import { useState } from "react"
import { Lock, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"

export function Step7Security({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword: externalShowPassword,
  setShowPassword: externalSetShowPassword,
  showConfirmPassword: externalShowConfirmPassword,
  setShowConfirmPassword: externalSetShowConfirmPassword,
}) {
  const [internalShowPassword, setInternalShowPassword] = useState(false)
  const [internalShowConfirmPassword, setInternalShowConfirmPassword] = useState(false)

  const isShowPassword =
    externalSetShowPassword !== undefined ? externalShowPassword : internalShowPassword
  const toggleShowPassword = () => {
    if (externalSetShowPassword) externalSetShowPassword(!externalShowPassword)
    else setInternalShowPassword((prev) => !prev)
  }

  const isShowConfirmPassword =
    externalSetShowConfirmPassword !== undefined
      ? externalShowConfirmPassword
      : internalShowConfirmPassword
  const toggleShowConfirmPassword = () => {
    if (externalSetShowConfirmPassword)
      externalSetShowConfirmPassword(!externalShowConfirmPassword)
    else setInternalShowConfirmPassword((prev) => !prev)
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-foreground">Step 7: Security Credentials</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
          Create the password you’ll use to sign in.
        </p>
      </div>

      {/* Password Box */}
      <div className="p-4.5 rounded-2xl border border-border bg-card space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Lock className="size-4 text-primary" />
          <span>Master Password</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Create Password</label>
            <div className="relative">
              <Input
                type={isShowPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 h-10 text-sm rounded-xl px-3.5"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={toggleShowPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {isShowPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-foreground block mb-0.5">Confirm Password</label>
            <div className="relative">
              <Input
                type={isShowConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10 h-10 text-sm rounded-xl px-3.5"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={toggleShowConfirmPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {isShowConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Step7Security
