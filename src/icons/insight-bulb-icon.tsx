export function InsightBulbIcon({ size = 21 }: { size?: number }) {
  return (
    <svg
      className="insight-bulb-icon"
      width={size}
      height={size}
      viewBox="0 -1.5 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 -0.45V1M4.55 1.95l1.2 1.2M18.25 3.15l1.2-1.2" />
      <path d="M9.1 16.15c-.15-1.02-.62-1.71-1.42-2.52C6.66 12.6 6.1 11.25 6.1 9.8a5.9 5.9 0 0 1 11.8 0c0 1.45-.56 2.8-1.58 3.83-.8.81-1.27 1.5-1.42 2.52"/>
      <path d="m9.75 10.45 2.25 2.3 2.25-2.3M12 12.75v2.35"/>
      <path d="M9.15 17.8h5.7M10.15 20.4h3.7"/>
    </svg>
  )
}
