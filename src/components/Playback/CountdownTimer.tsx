interface Props {
  remainingSecs: number
  playDuration: number
}

export function CountdownTimer({ remainingSecs, playDuration }: Props) {
  const elapsed = playDuration - remainingSecs
  const isRed = elapsed < 5 || remainingSecs <= 5
  const colorClass = isRed ? 'text-red-500' : 'text-green-400'

  const totalSecs = Math.ceil(remainingSecs)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const display = `${mins}:${secs.toString().padStart(2, '0')}`

  return (
    <div
      className={`font-mono font-bold tabular-nums transition-colors duration-200 ${colorClass}`}
      style={{ fontSize: 'clamp(5rem, 22vw, 14rem)', lineHeight: 1 }}
    >
      {display}
    </div>
  )
}
