# TrainWithMusic — Claude Code Context

## Project Overview
Mobile-first workout timer app that plays local audio tracks with configurable rest periods, beep countdowns, and fade transitions. Packaged as a native iOS and Android app via Capacitor.

**Author:** Dr. Michael Dinkel
**Version:** 0.1.0
**App ID:** `com.trainwithmusic.app`

---

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4
- **Audio:** Web Audio API (AudioContext, AudioBufferSourceNode, GainNode, OscillatorNode)
- **Storage:** IndexedDB via `idb` npm package
- **Native packaging:** Capacitor (iOS + Android)
- **iOS:** AVAudioSession `.playback` category for speaker output
- **Android:** Gradle build, `com.trainwithmusic.app`

---

## Key Commands

```bash
# Development
npm run dev

# Build web app
npm run build

# Sync to iOS (after every build)
npx cap sync ios

# Sync to Android (after every build)
npx cap sync android

# Build Android debug APK
cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug
# APK output: android/app/build/outputs/apk/debug/app-debug.apk

# Open iOS project in Xcode
npx cap open ios
```

---

## Architecture

### Screens (`src/types/index.ts`)
```
Screen = 'main' | 'about' | 'editor' | 'playback'
```
Managed in `App.tsx` with `useState<Screen>`.

### Data Model
- **TrainingList**: `{ id, name, tracks[], restTimeSecs, useBeeps, lastModified }`
- **Track**: `{ id, fileId, fileName, exerciseTitle, startOffset, playDuration }`
- Audio blobs stored in IndexedDB (`audioFiles` store, keyed by `fileId`)
- Training lists stored in IndexedDB (`trainingLists` store)

### Key Files
| File | Purpose |
|---|---|
| `src/hooks/usePlayback.ts` | All playback logic — state machine, timers, audio scheduling |
| `src/hooks/useTrainingStore.ts` | IndexedDB CRUD for training lists |
| `src/utils/audio.ts` | Web Audio API helpers |
| `src/utils/db.ts` | IndexedDB helpers |
| `src/components/MainScreen.tsx` | List of training lists |
| `src/components/AboutScreen.tsx` | App info / copyright |
| `src/components/Editor/TrainingListEditor.tsx` | Edit training list |
| `src/components/Editor/TrackRow.tsx` | Edit individual track |
| `src/components/Editor/WaveformEditor.tsx` | Waveform + start offset slider |
| `src/components/Playback/PlaybackScreen.tsx` | Full-screen playback UI |
| `src/components/Playback/CountdownTimer.tsx` | Large countdown timer |
| `ios/App/App/AppDelegate.swift` | AVAudioSession setup |
| `public/Finishing.m4a` | Workout completion sound |

---

## Playback State Machine
```
idle → preparing → playing ⇄ paused
                 → resting ⇄ paused
                 → completed
                 → stopped
```

### PlaybackStatus fields
- `state`: current state
- `trackIndex`: index of current/upcoming track
- `totalTracks`: total track count
- `remainingSecs`: countdown seconds
- `playDuration`: total duration of current segment
- `pausedRestState?`: `'resting' | 'preparing'` — set when paused during rest to keep rest UI visible

### Key refs in usePlayback
- `activeSource` / `activeGainRef` — current music source + gain node
- `pendingSourceRef` / `pendingGainRef` — pre-scheduled source for fade-in overlap during rest
- `cachedBufferRef` / `cachedFileIdRef` — decoded AudioBuffer cache to avoid re-fetching on resume
- `pausedElapsedRef` — elapsed seconds in track when paused
- `pausedInRestRef` — whether paused during rest
- `nextRestTrackIndexRef` — track index the current/upcoming rest leads into
- `restEndCallbackRef` — callback to invoke when rest countdown ends

---

## Audio Design

### Fade-in / Fade-out
- `playAudioBuffer(buffer, offset, duration, { fadeInSecs, fadeOutSecs, startAt })`
- All music tracks: 1s fade-in + 1s fade-out via GainNode ramps
- Finishing sound (`Finishing.m4a`): 0.5s fade-in + 0.5s fade-out
- `quickFadeOut(gain)` — 50ms ramp used on premature stop to prevent clicks

### Pre-scheduled Overlap
When rest > 1.1s, the next track's audio is pre-fetched and scheduled to start 1 second before rest ends (gain 0→1), so the music fades in during the last second of the rest countdown.

### Beeps
- 5 beeps at end of rest (last 5 seconds), synced with countdown
- 5 beeps at end of music track (last 5 seconds)
- Rescheduled correctly after pause/resume

### Skip Behavior
All skips land on a **rest period** (not mid-track):
- **Skip forward**: → rest before next track (or complete if last)
- **Skip back**: playing → rest before same track; in rest → rest before previous track
- Paused + skip: updates refs without starting playback; resume picks up from new position

---

## iOS-Specific Notes
- `viewport-fit=cover` + `env(safe-area-inset-top)` for Dynamic Island / notch
- `.safe-top` / `.safe-bottom` CSS utility classes in `src/index.css`
- `font-size: max(16px, 1em)` on all inputs prevents iOS auto-zoom
- All screens use `h-dvh` (not `min-h-dvh`) to prevent full-page scroll
- AVAudioSession `.playback` in `AppDelegate.swift` routes audio through speaker
- **`ViewController.swift`** exists in the Xcode project and sets `allowsAirPlayForMediaPlayback = true` on the WKWebViewConfiguration. The storyboard still uses `CAPBridgeViewController` as the root VC class (file must be added/kept in Xcode manually — not auto-discovered).
- **AirPlay limitation (known):** Web Audio API (`AudioContext`) audio cannot route to AirPlay on iOS. The `WebContent` sandbox process cannot connect to `com.apple.audio.AudioComponentRegistrar` (NSXPCConnectionInvalid, Code=4099) which is required for network audio streaming. Bluetooth speakers work fine (local hardware output, no sandbox restriction). AirPlay would require switching to `<audio>` elements or an `AVPlayer`-based Capacitor plugin. Accepted as a known limitation.
- **AudioContext recovery** is in place for other interruptions (Bluetooth route changes, phone calls): `AppDelegate` observes `AVAudioSession.routeChangeNotification` and `interruptionNotification`, reactivates the session, and calls `window.__resumeAudioContext()` via JS injection. `audio.ts` also auto-resumes on `ctx.onstatechange`.

## Android-Specific Notes
- `androidScheme: 'https'` in `capacitor.config.ts`
- `local.properties` sets `sdk.dir` (not committed — generated at build time)
- Build requires **Java 21**: `JAVA_HOME=/opt/homebrew/opt/openjdk@21`
- Debug APK can be shared directly via email/file transfer (no Play Store needed)

---

## .gitignore Notes
Audio files (`*.mp3`, `*.m4a`, `*.wav` etc.) are ignored **except**:
- `public/applause.wav`
- `public/Finishing.m4a`

---

## Git Workflow

**Remote:** `https://github.com/midi-D/TrainWithMusic.git`
**Branch:** `main` (single branch, push directly)

### Commit convention
- Stage only relevant source files by name — never `git add -A` (avoids accidentally committing `.env`, large binaries, or music files)
- Never commit: `android/local.properties`, `dist/`, `node_modules/`, audio files (except the two whitelisted in `public/`)
- Commit message style: imperative, concise summary of *why* not *what* (see log above for examples)
- Always append co-author trailer:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- Use HEREDOC for commit messages to preserve formatting:
  ```bash
  git commit -m "$(cat <<'EOF'
  Your message here

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

### After every feature / fix
1. `npm run build` — must be clean (no TS errors)
2. `npx cap sync ios` — keeps iOS in sync
3. `npx cap sync android` — keeps Android in sync (optional if not actively testing Android)
4. `git add <specific files> && git commit && git push`

### Files never to commit
- `android/local.properties` (contains machine-specific SDK path, already in `.gitignore`)
- `dist/` (build output, already in `.gitignore`)
- Any `*.mp3`, `*.m4a`, `*.wav` files outside `public/applause.wav` and `public/Finishing.m4a`

---

## Conventions
- Numeric inputs use `type="text" inputMode="numeric"` with local string state (prevents iOS from snapping to 0 when deleting last digit)
- All outer screen containers use `h-dvh flex flex-col` with `flex-1 overflow-y-auto` for the scrollable body
- Callbacks in `usePlayback` use refs (not state) to avoid stale closures
- `statusRef` mirrors `status` state via `useEffect` for use inside interval callbacks
