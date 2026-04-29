import { useState } from 'react'
import type { AppSettings, InfoSection } from '../types'
import { useSpotifyContext } from '../contexts/SpotifyContext'

interface Props {
  settings: AppSettings
  onSettingsChange: (patch: Partial<AppSettings>) => void
  onInfoSelect: (section: InfoSection) => void
  onClose: () => void
}

const INFO_ITEMS: { section: InfoSection; label: string }[] = [
  { section: 'user-guide',        label: 'User Guide' },
  { section: 'known-limitations', label: 'Known Limitations' },
  { section: 'licensing',         label: 'About' },
]

const OTHER_SERVICES = ['Apple Music', 'Amazon Music', 'YouTube Music']

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 px-4 mb-1 mt-6 first:mt-0">
      {children}
    </p>
  )
}

function Row({ children, onClick, chevron }: { children: React.ReactNode; onClick?: () => void; chevron?: boolean }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 last:border-0 ${
        onClick ? 'active:bg-gray-200 dark:active:bg-gray-700 cursor-pointer' : ''
      }`}
    >
      {children}
      {chevron && (
        <span className="text-gray-400 dark:text-gray-500 text-sm ml-2">›</span>
      )}
    </div>
  )
}

function SpotifyRow() {
  const { status, displayName, errorMessage, connect, disconnect } = useSpotifyContext()

  const badge = (text: string, color: string) => (
    <span className={`text-xs rounded-full px-2 py-0.5 ${color}`}>{text}</span>
  )

  if (status === 'connected') {
    return (
      <Row>
        <span className="text-gray-900 dark:text-white text-sm">Spotify</span>
        <div className="flex items-center gap-2">
          {badge(`✓ ${displayName ?? 'Connected'}`, 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40')}
          <button
            onClick={disconnect}
            className="text-xs text-red-600 dark:text-red-400 underline"
          >
            Disconnect
          </button>
        </div>
      </Row>
    )
  }

  if (status === 'error') {
    return (
      <Row>
        <span className="text-gray-900 dark:text-white text-sm">Spotify</span>
        <div className="flex items-center gap-2">
          {badge(errorMessage ?? 'Error', 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40')}
          <button
            onClick={connect}
            className="text-xs text-blue-600 dark:text-blue-400 underline"
          >
            Retry
          </button>
        </div>
      </Row>
    )
  }

  if (status === 'connecting') {
    return (
      <Row>
        <span className="text-gray-900 dark:text-white text-sm">Spotify</span>
        {badge('Connecting…', 'text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700')}
      </Row>
    )
  }

  return (
    <Row onClick={connect} chevron>
      <span className="text-gray-900 dark:text-white text-sm">Spotify</span>
      {badge('Connect', 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40')}
    </Row>
  )
}

export function SettingsPanel({ settings, onSettingsChange, onInfoSelect, onClose }: Props) {
  const [restStr, setRestStr] = useState(String(settings.defaultRestTimeSecs))

  const handleInfoSelect = (section: InfoSection) => {
    onClose()
    onInfoSelect(section)
  }

  const commitRestTime = (raw: string) => {
    const val = Math.max(0, Number(raw) || 0)
    setRestStr(String(val))
    onSettingsChange({ defaultRestTimeSecs: val })
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div
        className="safe-top shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between"
      >
        <h1 className="text-gray-900 dark:text-white font-bold text-lg">Settings</h1>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 text-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-700 active:scale-95 transition"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-8">

        {/* Info */}
        <SectionHeading>Info</SectionHeading>
        <div className="rounded-xl overflow-hidden mx-4">
          {INFO_ITEMS.map(({ section, label }) => (
            <Row key={section} onClick={() => handleInfoSelect(section)} chevron>
              <span className="text-gray-900 dark:text-white text-sm">{label}</span>
            </Row>
          ))}
        </div>

        {/* Audio Defaults */}
        <SectionHeading>Audio Defaults</SectionHeading>
        <div className="rounded-xl overflow-hidden mx-4">
          <Row>
            <span className="text-gray-900 dark:text-white text-sm">Default rest time (sec)</span>
            <input
              type="text"
              inputMode="numeric"
              value={restStr}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '')
                setRestStr(digits)
                if (digits !== '') onSettingsChange({ defaultRestTimeSecs: Math.max(0, Number(digits)) })
              }}
              onBlur={() => commitRestTime(restStr)}
              className="w-16 text-right bg-gray-200 dark:bg-gray-700 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Row>
          <Row>
            <span className="text-gray-900 dark:text-white text-sm">Default Countdown Beeps</span>
            <button
              onClick={() => onSettingsChange({ defaultUseBeeps: !settings.defaultUseBeeps })}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                settings.defaultUseBeeps ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-checked={settings.defaultUseBeeps}
              role="switch"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                settings.defaultUseBeeps ? 'translate-x-5' : ''
              }`} />
            </button>
          </Row>
        </div>

        {/* Music Services */}
        <SectionHeading>Music Services</SectionHeading>
        <div className="rounded-xl overflow-hidden mx-4">
          <SpotifyRow />
          {OTHER_SERVICES.map((name) => (
            <Row key={name}>
              <span className="text-gray-900 dark:text-white text-sm">{name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
                Coming soon
              </span>
            </Row>
          ))}
        </div>

        {/* Display */}
        <SectionHeading>Display</SectionHeading>
        <div className="rounded-xl overflow-hidden mx-4">
          <Row>
            <span className="text-gray-900 dark:text-white text-sm">Theme</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onSettingsChange({ theme: t })}
                  className={`px-3 py-1 text-sm capitalize transition ${
                    settings.theme === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
        </div>
      </div>
    </div>
  )
}
