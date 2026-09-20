import { Lock, Hash, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"

export function Step7Security({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  pin,
  setPin,
  confirmPin,
  setConfirmPin,
  showPassword,
  setShowPassword,
  showPin,
  setShowPin,
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-foreground">Step 7: Security Credentials</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
          Configure your master password and 4-10 digit Quick Login PIN for fast terminal access.
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
            <label className="text-xs font-semibold text-foreground block mb-1">Create Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 h-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Confirm Password</label>
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
        </div>
      </div>

      {/* PIN Box */}
      <div className="p-4.5 rounded-2xl border border-border bg-card space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Hash className="size-4 text-primary" />
          <span>Quick Login PIN (4 to 10 numeric digits)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Create PIN</label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                maxLength={10}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="pr-10 h-10 text-sm font-mono tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Confirm PIN</label>
            <Input
              type={showPin ? "text" : "password"}
              maxLength={10}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="h-10 text-sm font-mono tracking-widest"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Step7Security
