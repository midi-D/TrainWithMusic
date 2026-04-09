# TrainWithMusic — Product Requirements

**Version:** 0.1.0
**Author:** Dr. Michael Dinkel
**App ID:** `com.trainwithmusic.app`

---

## 1. Overview

TrainWithMusic is a mobile-first workout timer app that plays locally-stored audio tracks as exercise accompaniment. The user builds named "training lists" consisting of music tracks (with configurable start position and duration), separated by configurable rest periods with optional countdown beeps. The app is packaged as a native iOS and Android app via Capacitor.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 |
| Audio | Web Audio API (AudioContext, AudioBufferSourceNode, GainNode, OscillatorNode) |
| Storage | IndexedDB via `idb` npm package |
| Native packaging | Capacitor 8 (iOS + Android) |
| Screen wake-lock | `@capacitor-community/keep-awake` |

---

## 3. Data Model

### 3.1 TrainingList
```
id             string   Unique ID: "list_{timestamp}_{random}"
name           string   User-defined name (required to save)
tracks         Track[]  Ordered list of exercises
restTimeSecs   number   Rest duration between tracks in seconds (default: 10, min: 0)
useBeeps       boolean  Play countdown beeps (default: true)
lastModified   string   ISO date string; auto-set to now on every save
```

### 3.2 Track
```
id             string   Unique ID: "track_{timestamp}_{random}"
fileId         string   Reference to audio file in IndexedDB (empty until file selected)
fileName       string   Original filename for display
exerciseTitle  string   User-defined exercise name (optional)
startOffset    number   Seconds into the audio file where playback begins (default: 0, min: 0)
playDuration   number   How many seconds to play (default: 30, min: 1)
```

### 3.3 AudioFileRecord (internal)
```
id             string   Unique ID: "audio_{timestamp}_{random}"
fileName       string   Original filename
blob           Blob     Raw audio file data
```

### 3.4 Storage
- All data stored in browser IndexedDB.
- Store `trainingLists` — keyed by `id`, holds TrainingList objects (without audio blobs).
- Store `audioFiles` — keyed by `id`, holds AudioFileRecord objects (blob + filename).
- No cloud sync; data is local to the device.

---

## 4. Screen Navigation

```
main  ──(tap title)──►  info (user-guide | known-limitations | licensing)
  │                         │
  │◄────────(back)──────────┘
  │
  ├──(+ New / Edit)──►  editor
  │                         │
  │◄──────(save/cancel)─────┘
  │
  └──(▶ Play)──►  playback
                      │
                      └──(exit/stop)──► main
```

All screens use `h-dvh` (full dynamic viewport height) to prevent scrolling of the entire page on iOS.

---

## 5. Main Screen

### 5.1 Header
- App title: **TrainWithMusic** (bold, white, xl)
- Subtitle: "Your training lists" (gray, xs)
- Tapping the title/subtitle area opens a dropdown menu with three items:
  1. User Guide → opens info/user-guide screen
  2. Known Limitations → opens info/known-limitations screen
  3. About → opens info/licensing screen
- Dropdown is dismissed by tapping anywhere outside it.
- **+ New** button (blue) — top right; opens editor with a blank list.

### 5.2 List Area
- Lists are sorted by `lastModified`, newest first.
- **Empty state:** music emoji + "No training lists yet" + hint to tap + New.
- **Loading state:** centered "Loading…" text while IndexedDB loads.
- Each list is shown as a card with:
  - List name (truncated if too long)
  - Track count + last modified date (`Mon D, YYYY` format)
  - Three action buttons:
    - **Edit** — opens editor with a copy of the list
    - **▶ Play** — opens playback screen (disabled if the list has no tracks)
    - **🗑 Delete** — prompts for confirmation before deleting

---

## 6. Editor Screen

### 6.1 Header
- Back arrow (←) on left — navigates back to main without saving.
- Title: "Edit Training List" (existing) or "New Training List" (new).

### 6.2 List-Level Fields
- **Name** — text input (placeholder: "My workout"). Required to save; disabled save button if blank/whitespace.
- **Rest time (sec)** — numeric input (digits only, min 0). Rest duration between exercises. Label: "REST TIME (SEC)".
- **Start/Stop beeps** — checkbox toggle (label: "Start/Stop beeps", default: checked).

### 6.3 Track List
- Labelled "TRACKS (N)" where N is the current track count.
- Tracks displayed in order (top to bottom = first to last exercise).
- **+ Add Track** button — appends a new blank track with defaults.

### 6.4 Footer Buttons
- **Save as…** — opens an inline text field for a new name with "Save" and "Cancel" buttons. Creates a copy with the new name and returns to main.
- **Save** — saves the list under its current name and returns to main. Disabled if name is empty.

---

## 7. Track Row (within Editor)

Each track is displayed as a card with:

### 7.1 File Picker
- Button showing the filename (or "Select audio file…" if none).
- Tapping opens native file picker.
- Accepted formats: `.mp3`, `.m4a`, `.wav`, `.aac`, `.ogg`, `.flac`, `.mp4`, `audio/*`.
- On file selection: save blob to IndexedDB, update `fileId` and `fileName`.

### 7.2 Reorder & Delete Controls
- **↑** move up (disabled on first track)
- **↓** move down (disabled on last track)
- **✕** delete — removes the track immediately (no confirmation)

### 7.3 Exercise Title
- Text input, optional, placeholder: "Exercise title (optional)".

### 7.4 Timing Inputs
- **Start (sec)** — numeric input (digits only). Where in the audio file to begin.
  - Min: 0. On blur, clamped to `[0, file_duration)`.
  - Changing start offset also re-clamps `playDuration` if needed.
- **Play for (sec)** — numeric input (digits only). How long to play.
  - Min: 1. On blur, clamped to `[1, file_duration − startOffset]`.

### 7.5 Waveform Editor (shown only after a file is selected)
- Displays a 200-bar RMS waveform of the audio file (channel 0).
- Green bars indicate the selected playback region `[startOffset, startOffset + playDuration]`.
- White vertical marker shows the start position.
- **Range slider** — adjusts `startOffset` from 0 to `floor(file_duration) − playDuration`.
- Info line: "Start: Xs / Total: M:SS".
- **▶ Preview selection** button — plays the selected segment. Becomes **■ Stop** while playing. Toggles on/off.

### 7.6 Auto-Clamping Logic
When `totalDuration` becomes known (after audio decodes):
- If the existing `startOffset + playDuration > totalDuration`, automatically reduce `playDuration` to `max(1, totalDuration − startOffset)`.
- Apply same clamping whenever `startOffset` is changed via text field (on blur) or slider.

---

## 8. Playback Screen

### 8.1 Layout
- Full-screen dark background.
- **Top bar:** Track counter "Track X / Y" (hidden during preparing/completed) on left; **×** close button on right.
- **Center area:** countdown timer + state label + exercise info.
- **Bottom controls:** skip back ⏮ | play/pause ▶/⏸ | skip forward ⏭.

### 8.2 Playback States

| State | Timer colour | Label | Sub-label |
|---|---|---|---|
| `preparing` | Red | "GET READY!" | Current track name |
| `resting` | Red | "REST" | "Next: {exercise}" or "Next: Almost done!" |
| `playing` | Green | Exercise title or filename | — |
| `paused` (was resting/preparing) | Red | "GET READY!" or "REST" | Same as rest state |
| `paused` (was playing) | Green | Exercise title or filename | — |
| `completed` | — | "SUCCESS!" (pulsing) | "Great workout!" |

### 8.3 Countdown Timer Display
- Format: `MM:SS` based on `Math.ceil(remainingSecs)`.
- Monospace, bold, tabular-nums; large responsive font (fills available width).
- **Progress bars (playing state only):** 5 horizontal bars below the timer. In the last 5 seconds of a track, bars light up green to indicate remaining beats in sync with beeps. One bar dims per second.

### 8.4 Controls
- All three buttons disabled unless state is `playing`, `resting`, `preparing`, or `paused`.
- Play/pause icon switches based on current state (paused → ▶, otherwise ⏸).
- **Skip forward:** jump to rest before next track, or complete if on last.
- **Skip back:**
  - While playing → jump to rest before current track.
  - While in rest → jump to rest before previous track.
- Skipping while paused stays paused at the new position; resume picks up from there.

### 8.5 Completion
- After last track ends: state becomes `completed`.
- Plays the finishing sound (`Finishing.m4a`) with 0.5s fade in + 0.5s fade out.
- After 3.5 seconds, automatically navigates back to main screen.

### 8.6 Screen Wake Lock
- `KeepAwake.keepAwake()` called on mount — screen stays on for the entire session.
- `KeepAwake.allowSleep()` called on unmount — normal auto-lock resumes.

---

## 9. Playback State Machine

### 9.1 States
```
idle → preparing → playing → resting → playing → ... → completed
                      ↕ paused ↕        ↕ paused ↕
                         stopped (user exits)
```

### 9.2 Flow Details
- **Start (restTimeSecs > 0):** `idle → preparing` (countdown before first track) `→ playing(0) → resting → playing(1) → ...`
- **Start (restTimeSecs = 0):** `idle → playing(0) → playing(1) → ...` (no rest)
- **Pause:** captures `remainingSecs` and current state; all audio faded out in 50ms.
- **Resume:** reschedules any applicable beeps; reactivates AudioContext; continues from saved position.
- **Stop:** fades out audio and returns to `stopped`; triggers `onExit`.

### 9.3 Constants
| Constant | Value | Description |
|---|---|---|
| FADE_SECS | 1.0 s | Music track fade in + fade out duration |
| BEEP_COUNT | 5 | Number of countdown beeps |
| Beep frequency | 880 Hz | Sine wave tone |
| Beep duration | 0.25 s | Each beep length |
| Beep amplitude | 0.6 | Gain value |
| Beep fade | 0.22 s | Ramp-to-zero duration to avoid click |
| Quick fade | 0.05 s | Pause/stop fade out |
| Status update interval | 100 ms | Timer tick rate |
| Completing delay | 3500 ms | Auto-exit after completion |
| AudioContext recovery delay | 200 ms | Delay before resume after suspend |

---

## 10. Audio Engine

### 10.1 Track Playback
- All music tracks play via `AudioBufferSourceNode` for precise scheduling.
- Fade in: first `FADE_SECS` seconds (linear ramp 0 → 1).
- Fade out: last `FADE_SECS` seconds (linear ramp 1 → 0).
- **Pre-scheduled overlap:** when `restTimeSecs > 1.1s`, the next track is pre-fetched and its audio source is scheduled to start fading in 1 second before the rest period ends, creating a seamless transition.

### 10.2 Beeps
- Scheduled at the last 5 seconds of each rest period and each track (if `useBeeps = true`).
- 5 beeps at offsets: t = duration−5, −4, −3, −2, −1 seconds from end.
- Re-scheduled correctly after pause/resume.

### 10.3 Finishing Sound
- File: `public/Finishing.m4a`
- Loaded at app start via `loadApplause()`.
- Played via `playApplause()` after last track completes.
- 0.5s fade in, 0.5s fade out.

### 10.4 AudioContext Recovery
- Global `window.__resumeAudioContext()` exposed for native iOS injection.
- `ctx.onstatechange` listener auto-resumes suspended context (200ms delay).
- iOS `AppDelegate` calls this after route-change and interruption events.

---

## 11. Info Screens

Accessed from the title dropdown on the main screen.

### 11.1 User Guide
Steps for creating training lists, using playback controls, and explanation of beep/fade behaviour and finishing sound.

### 11.2 Known Limitations
- **AirPlay (iOS):** Not supported. Bluetooth works.
- **Music Files:** Must be stored locally. No streaming services (Spotify, Apple Music, etc.).
- **Background Audio (iOS):** Continues when screen is locked. Auto-recovers after route changes.

### 11.3 About (Licensing)
- App name + version badge (0.1.0)
- Author: Dr. Michael Dinkel
- Copyright: © 2026 Dr. Michael Dinkel. All rights reserved.
- License: Personal use only. Redistribution or commercial use without explicit written permission is prohibited.
- Tech stack footer: "Built with React · Web Audio API · Capacitor"

---

## 12. iOS Native Requirements

- **AVAudioSession category:** `.playback`, mode `.default` — audio continues in background and through speaker.
- **Route change observer:** on `AVAudioSession.routeChangeNotification`, reactivate session and call `window.__resumeAudioContext()` in WKWebView.
- **Interruption observer:** on `AVAudioSession.interruptionNotification` type `.ended`, reactivate session and resume audio.
- **WKWebViewConfiguration:** `allowsAirPlayForMediaPlayback = true` (set in `ViewController.swift`).
- **Safe area insets:** UI respects `env(safe-area-inset-top/bottom)` for Dynamic Island / notch.
- **Input font size:** all inputs use `font-size: max(16px, 1em)` to prevent iOS auto-zoom.

---

## 13. Android Native Requirements

- **App ID:** `com.trainwithmusic.app`
- **Activity:** `MainActivity extends BridgeActivity` (Capacitor default).
- **Permissions:** `android.permission.INTERNET` only.
- **Scheme:** `androidScheme: 'https'` in Capacitor config.
- **Screen wake lock:** handled by `@capacitor-community/keep-awake` plugin (uses `FLAG_KEEP_SCREEN_ON`); no manifest permission required.
- **Build:** Gradle, requires Java 21.

---

## 14. UI & Styling Requirements

### 14.1 Theme
- Dark-mode only. Background: `gray-950`. Surfaces: `gray-900` (header), `gray-800` (cards).
- Primary text: white. Secondary: `gray-400`. Muted: `gray-500/600`.
- Primary action: `blue-600`. Success/play: `green-400/700`. Danger: `red-400/900`. Rest timer: `red-500`.

### 14.2 Layout
- All screens: `h-dvh flex flex-col` (prevents iOS bounce scroll).
- Scrollable body: `flex-1 overflow-y-auto`.
- Touch targets: minimum 44×44pt.
- Active states: `active:scale-[0.98]` or `active:opacity-70` for feedback.

### 14.3 Input Behaviour
- All numeric inputs: `type="text" inputMode="numeric"` with local string state (prevents iOS snap-to-zero).
- Digit-only filter on change; clamping applied on blur.

---

## 15. File Assets

| File | Purpose |
|---|---|
| `public/Finishing.m4a` | Workout completion sound (committed; .gitignore exception) |

Audio files uploaded by users are stored in IndexedDB and are **not** committed to the repository.
