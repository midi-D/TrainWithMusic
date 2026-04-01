import type { InfoSection } from '../types'

interface Props {
  section: InfoSection
  onBack: () => void
}

const VERSION = '0.1.0'

const TITLES: Record<InfoSection, string> = {
  'user-guide':        'User Guide',
  'known-limitations': 'Known Limitations',
  'licensing':         'Licensing',
}

function UserGuide() {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <Section title="Getting Started">
        <p className="text-gray-300 leading-relaxed">
          TrainWithMusic lets you build workout playlists from your own music files, with configurable rest periods and countdown beeps between exercises.
        </p>
      </Section>

      <Section title="Creating a Training List">
        <ol className="flex flex-col gap-2 text-gray-300 leading-relaxed list-decimal list-inside">
          <li>Tap <strong className="text-white">+ New</strong> on the main screen.</li>
          <li>Give your list a name.</li>
          <li>Tap <strong className="text-white">+ Add Track</strong> and pick a music file from your device.</li>
          <li>Set the exercise title, start time, and play duration using the waveform editor.</li>
          <li>Repeat for each exercise. Set the rest time between tracks.</li>
          <li>Tap <strong className="text-white">Save</strong> when done.</li>
        </ol>
      </Section>

      <Section title="Playback Controls">
        <ul className="flex flex-col gap-2 text-gray-300 leading-relaxed">
          <li><strong className="text-white">Play / Pause</strong> — starts or pauses the workout.</li>
          <li><strong className="text-white">Skip forward</strong> — jumps to the rest before the next exercise.</li>
          <li><strong className="text-white">Skip back</strong> — jumps to the rest before the current (or previous) exercise.</li>
        </ul>
      </Section>

      <Section title="Beeps &amp; Fades">
        <p className="text-gray-300 leading-relaxed">
          If <em>Use Beeps</em> is enabled, 5 countdown beeps play during the last 5 seconds of each rest and each exercise. Music fades in over the last second of rest and fades out over the last second of each exercise.
        </p>
      </Section>

      <Section title="Finishing Sound">
        <p className="text-gray-300 leading-relaxed">
          A short applause sound plays automatically when all exercises are complete.
        </p>
      </Section>
    </div>
  )
}

function KnownLimitations() {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <Section title="AirPlay (iOS)">
        <p className="text-gray-300 leading-relaxed">
          Audio playback via AirPlay is not supported on iOS. The Web Audio API runs inside WKWebView's sandboxed process, which cannot access the system components required for AirPlay streaming.
        </p>
        <p className="text-gray-500 text-xs mt-2 leading-relaxed">
          Bluetooth speakers work correctly. AirPlay support would require a native audio plugin.
        </p>
      </Section>

      <Section title="Audio Files">
        <p className="text-gray-300 leading-relaxed">
          Audio files are stored locally on the device in the app's IndexedDB. They are not synced to iCloud or other devices.
        </p>
      </Section>

      <Section title="Background Audio (iOS)">
        <p className="text-gray-300 leading-relaxed">
          Playback continues when the screen is locked. If audio stops after a route change (e.g. connecting headphones), the app will attempt to resume automatically.
        </p>
      </Section>
    </div>
  )
}

function Licensing() {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="text-5xl">🎵</div>
        <h2 className="text-white text-2xl font-bold tracking-tight">TrainWithMusic</h2>
        <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-3 py-1">
          Version {VERSION}
        </span>
      </div>

      <Section title="Author">
        <p className="text-white font-medium">Dr. Michael Dinkel</p>
      </Section>

      <Section title="Copyright">
        <p className="text-gray-300">© 2026 Dr. Michael Dinkel</p>
        <p className="text-gray-500 text-xs mt-1">All rights reserved.</p>
      </Section>

      <Section title="License">
        <p className="text-gray-300 leading-relaxed">
          This software is provided for personal use only.
        </p>
        <p className="text-gray-500 text-xs mt-2 leading-relaxed">
          Redistribution, modification, or commercial use without explicit written permission from the author is strictly prohibited.
        </p>
      </Section>

      <div className="border-t border-gray-800 pt-4">
        <p className="text-gray-700 text-xs text-center">
          Built with React · Web Audio API · Capacitor
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}

export function InfoScreen({ section, onBack }: Props) {
  return (
    <div className="h-dvh flex flex-col bg-gray-950">
      {/* Header */}
      <div className="safe-top sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white text-xl font-bold leading-none w-8 h-8 flex items-center justify-center"
          aria-label="Back"
        >←</button>
        <h1 className="text-white font-bold text-lg">{TITLES[section]}</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {section === 'user-guide'        && <UserGuide />}
        {section === 'known-limitations' && <KnownLimitations />}
        {section === 'licensing'         && <Licensing />}
      </div>
    </div>
  )
}
