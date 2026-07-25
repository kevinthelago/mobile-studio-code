# App Store review notes — Mobile Studio Code

Paste the "For the reviewer" section into App Store Connect → App Review Information → **Notes**.
The rest is context for us.

---

## For the reviewer

**No account, login, hardware, or external software is required to review this app.**

Mobile Studio Code is a mobile companion to the base-studio-code desktop development environment. It
can pair with a desktop over an end-to-end-encrypted tunnel to mirror live state — but pairing is
**optional**, and everything is exercisable without it:

- **On first launch, every tab is populated with representative sample data** so you can review the
  full UI immediately:
  - **Glance** — a project network graph (tap nodes to inspect).
  - **Planner** — a local, on-device project planner.
  - **Skills** — a library of reusable agent skills, with groups and lessons.
  - **UI (Studio)** — the design-system components and themes (switch the Components / Themes segments).
  - **Automations** — scheduled rules and MCP server tools (switch the segments).
- **Theme switching** works standalone: **More → Theme**.
- The **More → Connection** screen is the optional desktop-pairing flow. You do **not** need to pair to
  review the app; without a paired desktop the app runs on the bundled sample data described above.

The app does not download or execute code. Its UI is rendered from **bundled declarative data**
(a component-tree format the app interprets natively); nothing is fetched-and-run at runtime.

---

## For us (context, not for the reviewer)

- **Why the sample data (guideline 2.1 completeness):** the app is a desktop mirror; without a paired
  desktop the mirror tabs would otherwise be empty ("Awaiting sync"). `MirrorContext` serves bundled
  demo projections (`src/lib/mirror/demoData.ts`) while no real connection has happened this session
  (`demoActive`); a real connection latches it off and live tunnel frames take over. So a reviewer sees
  a complete app; a real user sees their live desktop state.
- **Guideline 2.5.2 (no downloaded code):** the design-system UI renders from `GeneralNode` data via a
  bundled native interpreter (`src/components/kit/KitRenderer.tsx`). No source is fetched or eval'd. The
  optional tunnel carries **data** (store projections / declarative specs), never executable code.
- **Guideline 2.3.1 (not misleading):** the first-run data is representative sample content, replaced by
  live data on pairing. Consider a subtle on-screen "sample data" indicator while `demoActive` if review
  feedback asks for it.
- **Companion-app framing:** positioned as a companion that is fully functional standalone (sample data
  + the local Planner + theme switching), so it does not depend on unavailable hardware/software.
