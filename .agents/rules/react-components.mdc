---
description: React patterns (CodeReact) — one component per folder with TSX + module CSS
globs: "**/*.tsx"
alwaysApply: false
---

# React Patterns

## General Rules

- Use **functional components** and hooks
- Separate UI and logic: move Event Loop logic into **custom hooks** (useEventLoop, usePhaseQueue)
- Avoid unnecessary re-renders: use `useMemo`, `useCallback`, `React.memo` where appropriate

## Component Structure (CodeReact)

Each component must be in its **own folder**. The folder contains:
- Component file (`ComponentName.tsx`)
- Modular CSS file (`ComponentName.module.css`)

```
components/
  PhaseBlock/
    PhaseBlock.tsx
    PhaseBlock.module.css
  TaskQueue/
    TaskQueue.tsx
    TaskQueue.module.css
  CallStack/
    CallStack.tsx
    CallStack.module.css
```

## Examples

```tsx
// ✅ Separation of logic and presentation
function PhaseBlock({ phase, tasks, isActive }: PhaseBlockProps) {
  return (
    <div data-phase={phase} className={isActive ? "active" : ""}>
      <h3>{phase}</h3>
      <TaskQueue items={tasks} />
    </div>
  );
}

// ✅ Custom hook for state
function useEventLoop() {
  const [phases, setPhases] = useState<PhaseState>(initialPhases);
  const [currentPhase, setCurrentPhase] = useState<Phase | null>(null);
  // ...
  return { phases, currentPhase, step, reset };
}
```

## Styles

- Each component has its own CSS module in the same folder (`ComponentName.module.css`)
- Shared global styles only in `App.css` if needed
