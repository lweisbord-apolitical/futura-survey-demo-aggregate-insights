# Futura Survey — Design Brief

A comprehensive design system and component reference for designers working on the Futura Survey application.

---

## Overview

**Futura Survey** is a conversational task capture tool that helps users describe their work activities. The design philosophy is **minimal, clean, and conversational** — avoiding UI clutter to let content breathe.

### User Flow
```
Landing → Job Title Input → Chat Interface → Task Review → Complete
   /    →    /survey       →  /survey/chat  → /survey/tasks → /survey/complete
```

### Design Principles
1. **Minimal chrome** — No heavy navigation, sidebars, or visual noise
2. **Content-first** — Large typography, generous whitespace
3. **Conversational** — Chat-like interactions feel natural
4. **Progressive disclosure** — Show only what's needed at each step
5. **Accessible** — High contrast, clear focus states, screen reader support

---

## Color System

### Primary Palette
The app uses Tailwind's neutral scale as the foundation, with violet as the accent color.

| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-900` | `#171717` | Primary text, headings, buttons |
| `neutral-800` | `#262626` | Body text |
| `neutral-600` | `#525252` | Secondary text emphasis |
| `neutral-500` | `#737373` | Secondary text, descriptions |
| `neutral-400` | `#a3a3a3` | Tertiary text, hints, step indicators |
| `neutral-300` | `#d4d4d4` | Disabled states, subtle accents |
| `neutral-200` | `#e5e5e5` | Borders, dividers |
| `neutral-100` | `#f5f5f5` | Background accents, hover states |

### Accent Colors
```css
/* Violet — Primary accent (voice buttons, focus states) */
violet-500: #8b5cf6  /* Default */
violet-600: #7c3aed  /* Hover */
violet-100: #ede9fe  /* Light background */
violet-200: #ddd6fe  /* Light hover */

/* Red — Recording states, errors */
red-500: #ef4444    /* Recording indicator */
red-600: #dc2626    /* Error text */

/* Green — Success states */
green-100: #dcfce7  /* Success background */
green-600: #16a34a  /* Success icon */
```

### Background Gradient (Landing Page)
```tsx
<div
  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] blur-3xl"
  style={{
    background: "radial-gradient(ellipse at center, #ede9fe 0%, #ddd6fe 30%, #c7d2fe 50%, transparent 70%)",
  }}
/>
```

---

## Typography

### Font Stack
```css
font-family: var(--font-inter), system-ui, sans-serif;
```
The app uses **Inter** as the primary font (loaded via Next.js).

### Type Scale

| Element | Class | Size | Weight |
|---------|-------|------|--------|
| Page heading | `text-3xl sm:text-4xl font-semibold tracking-tight` | 30px / 36px | 600 |
| Section heading | `text-lg font-medium` | 18px | 500 |
| Body text | `text-lg` or `text-base` | 18px / 16px | 400 |
| Small text | `text-sm` | 14px | 400 |
| Tiny text | `text-xs` | 12px | 400 |
| Input text | `text-xl sm:text-2xl font-medium` | 20px / 24px | 500 |

### Heading Examples
```tsx
{/* Primary page heading */}
<h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
  What's your job title?
</h1>

{/* Section heading */}
<h2 className="text-lg font-medium text-neutral-900 mb-4">
  What happens next
</h2>

{/* Step indicator */}
<p className="text-sm text-neutral-400 mb-2">Step 1 of 4</p>
```

---

## Layout System

### Page Structure
```tsx
<div className="min-h-screen flex flex-col bg-white">
  <header className="border-b border-neutral-100">
    {/* Header content */}
  </header>
  <main className="flex-1 px-6 sm:px-8 py-8 sm:py-12 max-w-2xl mx-auto w-full">
    {/* Page content */}
  </main>
</div>
```

### Content Containers
```tsx
{/* Narrow content (forms, text) */}
<div className="max-w-md mx-auto">

{/* Medium content (general pages) */}
<div className="max-w-2xl mx-auto">

{/* Chat messages */}
<div className="max-w-[85%] sm:max-w-[75%]">  {/* User messages */}
<div className="max-w-[85%] sm:max-w-[80%]">  {/* Assistant messages */}
```

### Spacing
- Page padding: `px-6 sm:px-8 py-8 sm:py-12`
- Section spacing: `mt-8`, `mt-10`, `mt-12`
- Element spacing: `mt-2`, `mt-3`, `mt-4`
- Border padding: `pt-8` with `border-t border-neutral-100`

---

## Components

### Buttons

#### Primary Text Button (CTA)
```tsx
<button className="inline-flex items-center gap-2 text-base font-medium text-neutral-900 hover:text-neutral-600 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors">
  Continue
  <ArrowRight className="h-5 w-5" />
</button>
```

#### Secondary Text Button
```tsx
<button className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
  Start new survey
  <ArrowRight className="h-4 w-4" />
</button>
```

#### Voice Button (Large)
```tsx
<button
  className={`flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-sm ${
    isRecording
      ? "bg-red-500 text-white shadow-red-200"
      : "bg-violet-500 text-white hover:bg-violet-600 shadow-violet-200"
  }`}
>
  <Mic className="h-6 w-6" />
</button>
```

#### Voice Button (Small)
```tsx
<button
  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
    isRecording
      ? "bg-red-500 text-white"
      : "bg-violet-100 text-violet-600 hover:bg-violet-200"
  }`}
>
  <Mic className="h-5 w-5" />
</button>
```

### Inputs

#### Text Input (Underline Style)
```tsx
<input
  type="text"
  placeholder="e.g., Product Manager"
  className="w-full text-xl sm:text-2xl font-medium text-neutral-900 placeholder:text-neutral-300 border-0 border-b-2 border-neutral-200 focus:border-violet-600 focus:ring-0 bg-transparent py-3 px-0 transition-colors outline-none"
/>
```

#### Textarea (Auto-resize)
```tsx
<textarea
  placeholder="Describe your tasks..."
  rows={2}
  className="flex-1 text-neutral-900 placeholder:text-neutral-300 border-0 border-b-2 border-neutral-200 focus:border-violet-600 focus:ring-0 bg-transparent py-3 px-0 resize-none outline-none overflow-hidden"
/>
```

### Progress Bar
```tsx
<div className="w-24 h-1 bg-neutral-100 rounded-full overflow-hidden">
  <div
    className="h-full bg-neutral-900 rounded-full transition-all duration-500"
    style={{ width: `${progressValue}%` }}
  />
</div>
```

### Checkboxes (Custom)
```tsx
<div
  className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
    isSelected
      ? "bg-neutral-900 border-neutral-900"
      : "border-neutral-300"
  }`}
>
  {isSelected && <Check className="h-3 w-3 text-white" />}
</div>
```

### Radio Pills (Likert Scale)
```tsx
<div className="flex flex-wrap gap-2">
  {options.map((option) => (
    <button
      key={option.value}
      onClick={() => setSelected(option.value)}
      className={`px-4 py-2 rounded-full text-sm transition-colors ${
        selected === option.value
          ? "bg-neutral-900 text-white"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
      }`}
    >
      {option.label}
    </button>
  ))}
</div>
```

### Tooltips
```tsx
<div className="absolute left-0 top-full mt-2 w-52 p-2 bg-neutral-800 text-white text-xs rounded-lg shadow-lg z-10">
  Take 2-3 minutes to talk through your work.
</div>
```

---

## Chat Interface

### Message Container
```tsx
<div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
  {/* Messages rendered here */}
</div>
```

### User Message
```tsx
<div className="flex justify-end">
  <div className="max-w-[85%] sm:max-w-[75%] flex gap-3 flex-row-reverse">
    <div className="w-0.5 bg-neutral-300 rounded-full flex-shrink-0" />
    <div className="py-1">
      <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-neutral-800">
        {message.content}
      </p>
    </div>
  </div>
</div>
```

### Assistant Message
```tsx
<div className="flex justify-start">
  <div className="max-w-[85%] sm:max-w-[80%] flex gap-3">
    <div className="w-0.5 bg-neutral-200 rounded-full flex-shrink-0" />
    <div className="py-1">
      <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-neutral-800">
        {message.content}
      </p>
    </div>
  </div>
</div>
```

### Chat Input Area
```tsx
<div className="border-t border-neutral-100 bg-white p-4 flex items-center gap-3">
  {/* Voice button */}
  <button className="w-12 h-12 rounded-full bg-violet-100 text-violet-600">
    <Mic className="h-5 w-5" />
  </button>

  {/* Text input */}
  <textarea
    placeholder="Describe your tasks..."
    className="flex-1 border-0 border-b-2 border-neutral-200 focus:border-violet-600 ..."
  />

  {/* Send button */}
  <button className="text-neutral-900 hover:text-neutral-600">
    <Send className="h-5 w-5" />
  </button>
</div>
```

### Suggestion Cards (Inline)
```tsx
<div className="mt-4 pt-4 border-t border-neutral-100">
  <p className="text-sm text-neutral-500 mb-3">Select any that apply:</p>

  {suggestions.map((suggestion) => (
    <button
      className={`w-full text-left py-2 border-b transition-colors ${
        isSelected ? "border-neutral-900" : "border-neutral-100 hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className={`mt-1 w-4 h-4 rounded-sm border ... ${
          isSelected ? "bg-neutral-900 border-neutral-900" : "border-neutral-300"
        }`}>
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

        {/* Content */}
        <div className="flex-1">
          <p className="text-sm text-neutral-900">{suggestion.statement}</p>
          <span className="text-xs text-neutral-400">{suggestion.category}</span>
        </div>
      </div>
    </button>
  ))}
</div>
```

---

## Page Templates

### Simple Form Page
```tsx
export default function FormPage() {
  return (
    <SurveyLayout currentStep={1} totalSteps={4}>
      <div className="max-w-md mx-auto">
        {/* Step indicator */}
        <p className="text-sm text-neutral-400 mb-2">Step 1 of 4</p>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
          Page Title
        </h1>

        <p className="mt-3 text-neutral-500 text-lg">
          Supporting description text.
        </p>

        {/* Form */}
        <form className="mt-8">
          <input ... />

          <button className="mt-8 inline-flex items-center gap-2 ...">
            Continue <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </div>
    </SurveyLayout>
  );
}
```

### Success/Complete Page
```tsx
<div className="max-w-md">
  <p className="text-sm text-neutral-400 mb-2">Complete</p>

  {/* Success indicator */}
  <div className="flex items-center gap-3 mb-6">
    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
      <Check className="h-4 w-4 text-green-600" />
    </div>
    <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
      All done!
    </h1>
  </div>

  <p className="text-neutral-500 text-lg">Thank you message.</p>

  {/* What's next section */}
  <div className="mt-10 pt-8 border-t border-neutral-100">
    <h2 className="text-lg font-medium text-neutral-900 mb-4">What happens next</h2>

    <div className="space-y-4">
      {steps.map((step, i) => (
        <div className="flex items-start gap-3">
          <span className="text-neutral-400 text-sm">{i + 1}</span>
          <div>
            <p className="text-neutral-900">{step.title}</p>
            <p className="text-sm text-neutral-500">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

---

## Icons

Using **Lucide React** icons throughout:

```tsx
import {
  ArrowRight,    // Navigation, CTAs
  ArrowLeft,     // Back navigation
  Check,         // Checkboxes, success
  Mic,           // Voice input (default)
  MicOff,        // Voice input (recording)
  Send,          // Send message
  Loader2,       // Loading spinner (with animate-spin)
  Plus,          // Add item
  X,             // Close, remove
} from "lucide-react";
```

### Icon Sizes
- Large (buttons): `h-6 w-6`
- Medium (inline): `h-5 w-5`
- Small (labels): `h-4 w-4`
- Tiny (badges): `h-3 w-3`

---

## Animation & Transitions

### Standard Transitions
```css
transition-colors  /* Color changes (default) */
transition-all     /* Multi-property changes */
duration-500       /* Progress bars */
```

### Loading Spinner
```tsx
<Loader2 className="h-5 w-5 animate-spin" />
```

### Recording Pulse
```tsx
<span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
```

### Progress Bar Animation
```tsx
<div
  className="h-full bg-neutral-900 rounded-full transition-all duration-500"
  style={{ width: `${progressValue}%` }}
/>
```

---

## Accessibility

### Focus States
All interactive elements use `focus:border-violet-600` or similar high-contrast focus indicators.

### ARIA Labels
```tsx
<button
  aria-label="Start voice input"
  aria-pressed={isRecording}
>

<div role="listitem" aria-label={`You said: ${message.content}`}>

<textarea aria-describedby="input-hint" />
<span id="input-hint" className="sr-only">Press Enter to send</span>
```

### Screen Reader Text
```tsx
<span className="sr-only">Hidden accessible text</span>
```

---

## Responsive Breakpoints

```css
/* Mobile first — default styles */
text-3xl        /* 30px */
px-6            /* 24px */

/* sm: 640px+ */
sm:text-4xl     /* 36px */
sm:px-8         /* 32px */

/* Message widths */
max-w-[85%]            /* Mobile */
sm:max-w-[75%]         /* Desktop user messages */
sm:max-w-[80%]         /* Desktop assistant messages */
```

---

## File Structure

```
src/app/
├── page.tsx                           # Landing page
├── globals.css                        # Global styles
├── survey/
│   ├── page.tsx                       # Job title input
│   ├── chat/page.tsx                  # Chat interface
│   ├── tasks/page.tsx                 # Task review
│   ├── complete/page.tsx              # Success page
│   └── _components/
│       ├── survey-layout.tsx          # Page wrapper
│       ├── survey-header.tsx          # Header with progress
│       ├── chat/
│       │   ├── chat-container.tsx     # Main chat logic
│       │   ├── chat-messages.tsx      # Message list
│       │   ├── chat-message.tsx       # Single message
│       │   ├── chat-input.tsx         # Input area
│       │   └── initial-prompt.tsx     # Initial task dump
│       └── tasks/
│           └── task-data-collection.tsx
```

---

## Quick Reference: Common Patterns

### Text Colors
- Primary: `text-neutral-900`
- Body: `text-neutral-800`
- Secondary: `text-neutral-500`
- Muted: `text-neutral-400`
- Disabled: `text-neutral-300`
- Error: `text-red-600`
- Success: `text-green-600`

### Borders
- Subtle: `border-neutral-100`
- Default: `border-neutral-200`
- Strong: `border-neutral-300`
- Active: `border-neutral-900`
- Focus: `border-violet-600`

### Backgrounds
- Page: `bg-white`
- Subtle: `bg-neutral-100`
- Accent: `bg-violet-100`
- Active: `bg-neutral-900`
- Success: `bg-green-100`
- Error: `bg-red-500`

### Border Radius
- Buttons: `rounded-full`
- Checkboxes: `rounded-sm`
- Tooltips: `rounded-lg`
- Progress: `rounded-full`
