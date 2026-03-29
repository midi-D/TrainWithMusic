interface Props {
  remainingSecs: number
  isRest?: boolean
}

export function CountdownTimer({ remainingSecs, isRest = false }: Props) {
  const colorClass = isRest ? 'text-red-500' : 'text-green-400'

  const totalSecs = Math.ceil(remainingSecs)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const display = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  // Progress bar: during last 5 s of music, one segment turns off per second
  // barCount = 5 → 4 → 3 → 2 → 1 in sync with each beep
  const inLastFive = !isRest && remainingSecs > 0 && remainingSecs <= 5
  const barCount = inLastFive ? Math.min(5, Math.ceil(remainingSecs)) : 0

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Progress bar — space always reserved during music so layout doesn't jump */}
      {!isRest && (
        <div className="flex gap-2 w-full px-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`flex-1 rounded-full transition-colors duration-100 ${
                inLastFive && step <= barCount ? 'bg-green-400' : 'bg-gray-800'
              }`}
              style={{ height: '0.65rem' }}
            />
          ))}
        </div>
      )}

      {/* Timer digits — sized to fill the available width for "00:00" */}
      <div
        className={`font-mono font-bold tabular-nums ${colorClass}`}
        style={{ fontSize: 'min(calc((100vw - 2rem) / 3), 20rem)', lineHeight: 1 }}
      >
        {display}
      </div>
    </div>
  )
}
