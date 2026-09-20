import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { preferredLanguage, ui } from "@/lib/ui-copy"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label={ui(preferredLanguage(), "loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
