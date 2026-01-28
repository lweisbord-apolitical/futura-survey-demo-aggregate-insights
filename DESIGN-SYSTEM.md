# Futura Survey Design System

A minimal, focused design system built on Tailwind CSS defaults with a neutral + violet accent palette.

---

## Core Principles

1. **Minimal & Clean** - White backgrounds, generous whitespace, no visual clutter
2. **Focused Interactions** - One primary action per screen, clear hierarchy
3. **Conversational Feel** - Friendly copy, underline inputs (not boxed), flowing layouts
4. **Mobile-First** - Touch-friendly targets, responsive typography

---

## Colors

### Neutral Palette (Primary)
Used for text, borders, and backgrounds. Based on Tailwind's neutral scale.

| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-900` | `#171717` | Primary text, active states, headings |
| `neutral-800` | `#262626` | Body text in messages |
| `neutral-700` | `#404040` | Secondary emphasis text |
| `neutral-600` | `#525252` | Button text (inactive pills) |
| `neutral-500` | `#737373` | Subheadings, descriptions |
| `neutral-400` | `#a3a3a3` | Muted text, step indicators, placeholders hover |
| `neutral-300` | `#d4d4d4` | Disabled states, placeholder text, borders |
| `neutral-200` | `#e5e5e5` | Input underlines, light borders |
| `neutral-100` | `#f5f5f5` | Dividers, section borders, pill backgrounds |
| `neutral-50` | `#fafafa` | Subtle backgrounds, hover states |

### Accent Colors

| Color | Usage |
|-------|-------|
| `violet-500` | Primary accent - mic buttons, active icons |
| `violet-600` | Primary accent hover/active states, CTA buttons |
| `violet-100` | Accent backgrounds (mic button idle) |
| `violet-200` | Shadows on accent buttons |
| `green-500` | Success/completion (progress segments) |
| `green-600` | Success icons |
| `green-100` | Success icon backgrounds |
| `red-500` | Recording indicator (chat input only), errors |
| `red-600` | Error text |

### Theme Colors (Charts/Visualizations)

```tsx
const THEME_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];
```

---

## Typography

### Font Stack
```css
font-family: var(--font-inter), system-ui, sans-serif;
```

### Scale

| Element | Classes | Example |
|---------|---------|---------|
| Page heading | `text-3xl sm:text-4xl font-semibold tracking-tight` | "What's your job title?" |
| Section heading | `text-2xl font-semibold` | "Rate your tasks" |
| Subheading | `text-lg font-medium` | "What happens next" |
| Body/description | `text-lg text-neutral-500` | Intro paragraphs |
| Body text | `text-sm sm:text-base leading-relaxed` | Chat messages |
| Small/muted | `text-sm text-neutral-500` | Helper text |
| Step indicator | `text-sm text-neutral-400` | "Step 1 of 4" |
| Labels | `text-xs text-neutral-400` | Category labels |

---

## Layout

### Page Structure
```tsx
<div className="min-h-screen bg-white">
  <header className="sticky top-0 z-50 bg-white border-b border-neutral-100">
    {/* Header content */}
  </header>
  <main className="px-6 sm:px-8 max-w-3xl mx-auto">
    {/* Page content */}
  </main>
</div>
```

### Content Widths

| Context | Class | Use Case |
|---------|-------|----------|
| Page max width | `max-w-3xl` | Main container |
| Form/content max | `max-w-md` | Single-column forms |
| Narrow content | `max-w-lg` | Review screens |

### Spacing

| Pattern | Classes |
|---------|---------|
| Page padding | `py-8 sm:py-12` |
| Section gap | `mt-10` |
| Element gap | `mt-8` |
| Tight gap | `mt-4` |
| Inline gap | `gap-2` to `gap-5` |

---

## Components

### Text Inputs (Underline Style)

Primary input style - no borders, just an underline that changes on focus.

```tsx
<input
  className="w-full text-xl sm:text-2xl font-medium text-neutral-900
    placeholder:text-neutral-300
    border-0 border-b-2 border-neutral-200
    focus:border-violet-600 focus:ring-0
    bg-transparent py-3 px-0
    transition-colors outline-none"
/>
```

**Textarea variant:**
```tsx
<textarea
  className="w-full text-neutral-900 placeholder:text-neutral-300
    border-0 border-b-2 border-neutral-200
    focus:border-violet-600 focus:ring-0
    bg-transparent py-3 px-0
    resize-none outline-none
    text-base leading-relaxed"
/>
```

### Buttons

#### Primary Text Button (Continue/Submit)
```tsx
<button className="inline-flex items-center gap-2
  text-base font-medium text-neutral-900
  hover:text-neutral-600
  disabled:text-neutral-300 disabled:cursor-not-allowed
  transition-colors">
  Continue
  <ArrowRight className="h-5 w-5" />
</button>
```

#### Secondary/Back Button
```tsx
<button className="inline-flex items-center gap-2
  text-sm text-neutral-400
  hover:text-neutral-600
  transition-colors">
  <ArrowLeft className="h-4 w-4" />
  Back
</button>
```

#### Pill Button (Selectable Options)
```tsx
<button className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
  isSelected
    ? "bg-neutral-900 text-white"
    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
}`}>
  Option
</button>
```

#### CTA Button (Filled)
```tsx
<button className="px-4 py-2 text-sm font-medium
  bg-violet-600 text-white rounded-lg
  hover:bg-violet-700
  disabled:bg-neutral-300 disabled:cursor-not-allowed
  transition-colors">
  Continue →
</button>
```

### Talk/Type Toggle

Pill-shaped segmented control for input mode selection.

```tsx
<div className="inline-flex bg-neutral-100 rounded-full p-1">
  <button className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
    isActive
      ? "bg-white shadow-sm text-neutral-900"
      : "text-neutral-400 hover:text-neutral-600"
  }`}>
    <Mic className={`inline-block w-4 h-4 mr-1.5 ${isActive ? "text-violet-500" : ""}`} />
    Talk
  </button>
  {/* Type button similar */}
</div>
```

### Voice Input Button

#### Large (Initial/AI Details screens)
```tsx
<button className={`w-16 h-16 rounded-full flex items-center justify-center
  shadow-sm transition-colors ${
    isRecording
      ? "bg-violet-600 text-white shadow-violet-200"
      : "bg-violet-500 text-white shadow-violet-200 hover:bg-violet-600"
  }`}>
  {isRecording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
</button>
```

#### Standard (Chat input)
```tsx
<button className={`w-12 h-12 rounded-full transition-all ${
  isRecording
    ? "bg-red-500 text-white"
    : "bg-violet-100 text-violet-600 hover:bg-violet-200"
}`}>
  {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
</button>
```

### Selection Cards (Underline Style)

Used for Yes/No choices and task suggestions.

```tsx
<button className={`w-full text-left py-4 border-b-2 transition-colors ${
  isSelected
    ? "border-violet-600 text-neutral-900"
    : "border-neutral-200 text-neutral-600 hover:border-violet-300"
}`}>
  <span className="text-lg font-medium">Option title</span>
  <p className="text-sm text-neutral-500 mt-0.5">Description</p>
</button>
```

### Checkbox Selection

```tsx
<div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
  isSelected
    ? "bg-neutral-900 border-neutral-900"
    : "border-neutral-300"
}`}>
  {isSelected && <Check className="h-3 w-3 text-white" />}
</div>
```

### Blockquote/Examples

```tsx
<div className="pl-4 border-l-2 border-neutral-200">
  <div className="space-y-1.5 text-neutral-500">
    <p>Example line one</p>
    <p>Example line two</p>
  </div>
</div>
```

### Progress Bar (Segmented)

```tsx
<div className="flex gap-1">
  {items.map((_, i) => (
    <div className={`flex-1 h-1.5 rounded-full transition-colors ${
      i < currentIndex
        ? "bg-green-500"        // Completed
        : i === currentIndex
        ? "bg-neutral-300"      // Current
        : "bg-neutral-200"      // Upcoming
    }`} />
  ))}
</div>
```

### Distribution Bar (Stacked)

```tsx
<div className="h-3 flex rounded-full overflow-hidden bg-neutral-100">
  {segments.map((segment, i) => (
    <div
      className={THEME_COLORS[i % THEME_COLORS.length]}
      style={{ width: `${segment.percent}%` }}
    />
  ))}
</div>
```

---

## Chat Messages

### User Message (Right-aligned)
```tsx
<div className="flex justify-end">
  <div className="max-w-[85%] sm:max-w-[75%] flex gap-3 flex-row-reverse">
    <div className="w-0.5 bg-neutral-300 rounded-full flex-shrink-0" />
    <div className="py-1">
      <p className="text-sm sm:text-base leading-relaxed text-neutral-800">
        {content}
      </p>
    </div>
  </div>
</div>
```

### Assistant Message (Left-aligned)
```tsx
<div className="flex justify-start">
  <div className="max-w-[85%] sm:max-w-[80%] flex gap-3">
    <div className="w-0.5 bg-neutral-200 rounded-full flex-shrink-0" />
    <div className="py-1">
      <p className="text-sm sm:text-base leading-relaxed text-neutral-800">
        {content}
      </p>
    </div>
  </div>
</div>
```

---

## Icons

Using [Lucide React](https://lucide.dev/) icons.

### Common Icons

| Icon | Usage |
|------|-------|
| `ArrowRight` | Continue/forward actions |
| `ArrowLeft` | Back navigation |
| `Mic` | Voice input |
| `Square` | Stop recording (filled) |
| `MicOff` | Stop recording (chat) |
| `Keyboard` | Type mode |
| `Check` | Selection, completion |
| `X` | Remove, close |
| `Loader2` | Loading spinner (with `animate-spin`) |
| `ChevronDown/Right` | Expand/collapse |
| `Send` | Submit message |

### Icon Sizes

| Context | Size |
|---------|------|
| In buttons | `h-4 w-4` to `h-5 w-5` |
| Large mic button | `h-6 w-6` |
| Inline with text | `h-4 w-4` |

---

## States

### Loading
```tsx
<Loader2 className="h-5 w-5 animate-spin" />

// Or bouncing dots
<span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
```

### Recording Indicator
```tsx
<span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
```

### Disabled
- Text: `text-neutral-300`
- Backgrounds: `bg-neutral-300`
- Cursor: `cursor-not-allowed`
- Opacity: `opacity-50`

### Hover
- Text: `neutral-900` → `neutral-600`
- Backgrounds: Add `-200` variant
- Borders: Add `-300` variant

---

## Responsive Patterns

### Typography Scaling
```tsx
text-3xl sm:text-4xl    // Headings
text-sm sm:text-base    // Body text
```

### Spacing
```tsx
py-8 sm:py-12           // Page padding
px-6 sm:px-8            // Horizontal padding
```

### Width Constraints
```tsx
max-w-[85%] sm:max-w-[75%]  // Chat messages
```

---

## Animation

### Transitions
```tsx
transition-colors       // Color changes
transition-all          // Multiple properties
duration-300            // Standard duration
ease-out                // Easing
```

### Animations
```tsx
animate-spin            // Loading spinners
animate-pulse           // Recording indicator
animate-bounce          // Loading dots
```

### Slide Animation (Task Cards)
```tsx
className={`transition-all duration-300 ease-out ${
  isAnimating
    ? "opacity-0 translate-x-4"
    : "opacity-100 translate-x-0"
}`}
```

---

## Z-Index Layers

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Header | `z-50` | Sticky header |
| Chat input | `z-40` | Fixed bottom input |
| Modals | `z-50` | Overlays |
| Tooltips | `z-10` | Popovers |

---

## Accessibility

- All interactive elements have `aria-label` or visible labels
- Focus states use `focus:border-violet-600`
- `sr-only` class for screen reader hints
- `aria-pressed` for toggle buttons
- `aria-live="polite"` for dynamic content
- Sufficient color contrast (neutral-900 on white)
