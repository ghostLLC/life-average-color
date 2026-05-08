# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"生活平均色" (Life Average Color) — a React Native 0.81 Android app that extracts dominant colors from photos within a selected time period, synthesizes a cross-photo color palette, and generates a shareable poster with AI-generated captions.

## Build & development

```bash
npm install

# Metro dev server
npx react-native start

# TypeScript check (no emit)
npx tsc --noEmit

# Build debug APK (requires JAVA_HOME pointing to JDK 17+)
cd android && gradlew.bat assembleDebug
# APK output: android/app/build/outputs/apk/debug/app-debug.apk
```

The `_build.bat` script at the root sets `JAVA_HOME=D:\Android\Android Studio\jbr` before running the Gradle build.

### Environment

Copy `.env.example` to `.env` and set `DEEPSEEK_API_KEY` (used by `babel-plugin-inline-dotenv` to inline at build time into `process.env.DEEPSEEK_API_KEY`). Without this key, caption generation silently falls back to a placeholder.

## Architecture

### Data flow: photo → analysis → result

```
usePhotos (CameraRoll.getPhotos)
  → PhotoPicker (OCR filter via ML Kit)
  → useColor.analyze()
      1. decodeImageToPixels (ImageResizer → RNFS read → pako PNG decode)
      2. extractDominantColors (sparse sample → RGB→LAB → K-means k=3)
      3. synthesizeColorPalette (weighted cross-photo K-means k=3)
      4. mergeCloseColors (adaptive-ΔE dedup → ratios)
      5. buildGradient (LAB interpolation with ratio-based positioning)
      6. nameColors (120-color Chinese palette → nearest LAB match)
      7. selectRecommendedPhotos (adaptive distance threshold)
      8. generateCaption (DeepSeek API, optional user feeling)
  → CardView (gradient + floating color labels + text overlay)
  → Poster (branded shareable image via ViewShot capture)
```

### Color pipeline (src/color/)

- **lab.ts** — `rgbToLab`/`labToRgb` (delegates to `color-convert`), `averageLab`
- **decodeImage.ts** — Custom pure-JS PNG decoder (chunk parser + pako inflate + unfilter). Resizes to 200px via `@bam.tech/react-native-image-resizer` first.
- **extract.ts** — Per-photo K-means (sparse 5000-point sample, k=3, `kmeans-ts`). Returns `ColorCluster[]` (LAB centroid + ratio).
- **synthesize.ts** — Cross-photo weighted K-means: each cluster expanded to `ratio × 100` discrete samples, consolidated K-means (k=3). Returns `{color, ratio}[]`.
- **gradient.ts** — Ratio-based LAB interpolation (cumulative ratio → anchor positions → linear interpolation → hex). `buildGradient(colors, stops, ratios)`.
- **beautify.ts** — Saturation boost (a,b × 1.08) + brightness boost (l × 1.01).
- **nameColor.ts** — 120-entry Chinese traditional color database, LAB Euclidean distance nearest match.

### Adaptive color merging (useColor.ts)

`mergeCloseColors` (ΔE threshold) + `adaptiveMergeThreshold`: near-neutral colors (chroma < 12) use ΔE=30 to avoid splitting grays into fake distinct colors; otherwise ΔE=18. Ratios are summed when merging, re-normalized after.

`selectRecommendedPhotos`: best photo within 2× distance of the closest match, capped at 3. If closest photo has distance > 50, returns nothing.

### Visual design system

Light warm-minimalist theme — not dark mode.

| Token | Value | Usage |
|---|---|---|
| Page background | `#F8F5F0` | SafeAreaView, scroll views |
| Card surface | `#FFFFFF` | Dialogs, input backgrounds, history cards |
| Primary text | `#1C1C1E` | Titles, labels |
| Secondary text | `rgba(28,28,30,0.45)` | Descriptions, hints |
| Muted text | `rgba(28,28,30,0.25)` | Placeholders, disabled states |
| Accent | `#C9745B` (warm coral) | Primary buttons, toggles, progress bars |
| Border | `rgba(0,0,0,0.06)` | Card borders, dividers |
| Status bar | `dark-content` | Matches light background |

Individual components (PeriodSelector, PhotoPicker, CustomDatePicker, Dialog) use these same tokens. The gradient card and poster backgrounds remain colorful — only the surrounding UI is light.

### Key native libraries

| Library | Replaces | Notes |
|---|---|---|
| `@react-native-camera-roll/camera-roll` | expo-media-library | `getPhotos` with `fromTime`/`toTime` |
| `@bam.tech/react-native-image-resizer` | expo-image-manipulator | `createResizedImage` → file, then `RNFS.readFile` base64 |
| `react-native-linear-gradient` | expo-linear-gradient | `colors` prop is mutable `(string\|number)[]` |
| `react-native-share` | expo-sharing / RN Share | FileProvider-based, shares to WeChat/QQ/etc |
| `@react-native-ml-kit/text-recognition` | — | Device-local OCR for screenshot detection |
| `babel-plugin-inline-dotenv` | expo-constants env | Inlines `.env` at Babel time |

### Android Gradle notes

- AGP 8.11.0, Kotlin 2.1.20, NDK 27.1.12297006
- SDK versions: compileSdk 36, minSdk 24, targetSdk 36
- `rootProject.ext` properties (`compileSdkVersion`, etc.) are set in root `build.gradle` ext block for legacy libraries that use `safeExtGet`
- Version catalog at `android/gradle/libs.versions.toml`
- Root `build.gradle` has `apply plugin: "com.facebook.react.rootproject"` from composite build
- `react-native-config` was removed (Gradle incompatibility with AGP 8.11) — env vars handled via `babel-plugin-inline-dotenv`

### App.tsx state machine

- **Home** (`!hasResult`): title (per-character gradient colors) + PeriodSelector (today/week/month/year/custom) + Analyze button (grayed out for cached periods) + history carousel (mini poster previews)
- **PhotoPicker** (`showPicker`): Modal with OCR auto-scan, green/red border real-time feedback, select/deselect, guidance banner
- **Analyzing** (`analyzing`): AnalysisAnimation (continuous particle convergence, no text)
- **Result** (`hasResult && result`): gradient card + recommended photos + feeling input + share/save buttons + poster photo toggle
- **Poster modal** (`showPoster`): full-screen poster preview + save-to-gallery

Cached results stored in `resultCache` (Map<string,AnalysisResult>) — switching to a previously-analyzed period grays out the analyze button with "已生成报告". History carousel cards jump directly to cached results.

Back gesture (Android): `BackHandler` intercepts at poster → picker → result → exit, in priority order. Save/share operations return to home after completion.

### Custom UI components (src/components/)

- **Dialog** — Dark-theme modal with spring-scale entrance animation, replaces `Alert.alert`
- **Toast** — Centered auto-dismissing notification, replaces success/error alerts
- **CustomDatePicker** — Scroll-wheel date picker (FlatList + snap), dark-themed bottom sheet
- **AnalysisAnimation** — 20 independently-animated color particles with orbital motion, convergence as progress increases. Pure visual, no text overlay.
- **PeriodSelector** — Period preset pills + navigation arrows + custom date range inputs
- **PhotoPicker** — Full-screen modal, 3-column photo grid, OCR status borders, guidance banner, select-all button
- **Poster** — Branded shareable image: gradient background + floating color labels + time/caption overlay + optional recommended photos

### CardView/Poster alignment

Both share identical color label positioning via `labelPosition(i, total)`:
```
pos = total <= 1 ? 0.5 : i / (total - 1)
top = 8 + pos * 55%, left = 8 + pos * 58%
```
Poster is effectively a scaled-up CardView with branding, optional photos, and a watermark (hidden when photos are shown).
