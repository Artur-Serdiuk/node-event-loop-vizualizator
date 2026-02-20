---
description: Project context - Node.js Event Loop visualizer
alwaysApply: true
---

# Project Context

This project is an **interactive Node.js Event Loop visualizer**. Goal: clearly demonstrate how the asynchronous model of Node.js works.

## Tech Stack

- React 19, TypeScript, Vite
- No external UI libraries (MUI, Chakra) — custom components only

## Main Tasks of the Visualizer

1. Display the **6 Event Loop phases** (libuv) in the correct order
2. Show **task queues** (callbacks) for each phase
3. Visualize **process.nextTick** and **Promise microtasks** (executed between phases)
4. Support step-by-step mode — "next step" for learning
5. Allow running demo code (setTimeout, setImmediate, fs, etc.) and show how tasks enter phases

## Key Principles

- Code must be clear and educational
- Visualization must accurately reflect real Node.js behavior
- All code must be written in English
