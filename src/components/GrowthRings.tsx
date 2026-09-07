interface GrowthRingsProps {
  className?: string
  label?: string
}

/**
 * Marca de lugar visual. Los anillos no expresan progreso, salud ni porcentaje.
 */
export function GrowthRings({ className = '', label }: GrowthRingsProps) {
  return (
    <svg className={`growth-rings ${className}`} viewBox="0 0 240 240" aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label}>
      <path d="M46 169C10 122 32 48 94 24c58-22 119 12 133 66" />
      <path d="M61 184c-45-36-38-109 8-143 49-36 121-18 147 32" />
      <path d="M84 201c-30-20-40-65-22-100 22-44 81-63 125-38" />
      <path d="M113 209c-20-19-23-51-8-74 17-25 53-33 79-17" />
      {label && <title>{label}</title>}
    </svg>
  )
}
