# page.tsx — Complete Patch Guide (v2 Fixes)

This file documents all changes needed in `page.tsx`.
There are 3 separate surgical edits — apply them in order.

---

## Patch A: Remove old stop button block
## (Fixes the split avatar/stop button layout in Image 7)

The old code had a SEPARATE stop button section that kept rendering alongside
the new StreamingChatMessage component. This caused the dots bubble to appear
WITHOUT an avatar, and the avatar to appear BELOW the bubble next to the stop button.

### FIND this pattern (it may use `X` icon or `Square` icon):

```tsx
{/* ❌ DELETE THIS ENTIRE BLOCK */}
{agentStreamState.status === "connecting" && (
  <div className="flex items-center gap-2">
    <BotAvatar />   {/* or whatever your avatar component is called */}
    <button onClick={handleStop}>
      <X size={16} />   {/* or Square or whatever icon */}
    </button>
  </div>
)}
```

### REPLACE with: nothing (delete it entirely)

The stop button now lives INSIDE StreamingChatMessage — you don't need this block.

---

## Patch B: Update how StreamingChatMessage is rendered
## (Fixes the avatar layout — self-contained component)

### FIND how you're currently rendering the streaming message:

```tsx
{/* ❌ OLD — avatar is outside the component */}
<div className="flex items-start gap-2">
  <BotAvatar />
  <StreamingChatMessage
    streamState={agentStreamState}
    onStop={handleStop}
  />
</div>
```

### REPLACE WITH:

```tsx
{/* ✅ NEW — no outer avatar wrapper needed; component handles it */}
<StreamingChatMessage
  streamState={agentStreamState}
  onStop={handleStop}
  {/* Optional: pass your existing avatar node if you want custom styling */}
  avatarNode={<YourBotAvatar />}
/>
```

The `StreamingChatMessage` component now renders its own avatar (or uses the
gradient default if you don't pass `avatarNode`).

---

## Patch C: Move CBSE Class selector + Free Trial into the header
## (Fixes them sitting outside the nav in a separate row — Images 1-5)

### FIND the input bar area at the BOTTOM of the page, which currently has:

```tsx
{/* ❌ CURRENT — selector and CTA in the content area above input */}
<div className="flex items-center gap-2 px-4 py-2">
  <ContextSelector ... />
  <FreeTrialButton ... />   {/* or whatever your CTA component is */}
</div>

<div className="...input-bar-area...">
  <MultiModalInput ... />
</div>
```

### REPLACE BY:
1. Moving `<ContextSelector>` and `<FreeTrialButton>` UP into your `<TutorHeader>` component
2. Leaving only `<MultiModalInput>` at the bottom

```tsx
{/* ✅ In TutorHeader (top of page): */}
<header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
  {/* Left: logo + title */}
  <div className="flex items-center gap-2">
    <DigiClassroomLogo />
    <span className="font-semibold text-gray-900">Digi Classroom</span>
  </div>

  {/* Right: context selector + free trial CTA */}
  <div className="flex items-center gap-2">
    <ContextSelector
      className="text-xs px-2.5 py-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-800"
    />
    <FreeTrialButton
      className="text-xs px-2.5 py-1.5 rounded-full bg-orange-500 text-white font-medium"
    />
  </div>
</header>

{/* ✅ Bottom input area — clean, just the input: */}
<div className="border-t border-gray-100 bg-white px-4 py-3">
  <MultiModalInput
    placeholder={getPlaceholderText({ phase, selectedSubject, selectedMode })}
    ...
  />
</div>
```

---

## Summary Table

| Patch | What to Change | Result |
|-------|---------------|--------|
| A | Delete old `{status === 'connecting' && <div><Avatar /><StopBtn /></div>}` block | Removes duplicate stop button with stray avatar |
| B | Remove `<BotAvatar />` wrapper around `<StreamingChatMessage>` | Avatar stays top-aligned next to bubble |
| C | Move `<ContextSelector>` and `<FreeTrialButton>` into `<TutorHeader>` | Clean input bar, header has context controls |
