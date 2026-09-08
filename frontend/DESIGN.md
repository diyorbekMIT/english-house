# Design System – Referral Platform

## Brand & Feel
- Audience: school directors, teachers, admins in Tashkent.
- Tone: professional, calm, trustworthy, not flashy.
- Avoid: overly bright gradients, heavy shadows, “AI demo” look.

## Colors
- Primary: deep blue #1E3A8A (used for primary buttons, active nav).
- Secondary: teal #0D9488 (used for highlights, success states).
- Background: very light gray #F8FAFC.
- Surface: white #FFFFFF with subtle border #E2E8F0.
- Text: dark slate #0F172A for headings, #334155 for body.
- Success: #10B981, Warning: #F59E0B, Error: #EF4444.

## Typography
- Font: Inter (or system sans-serif).
- Headings: bold, tight tracking.
- Body: regular, comfortable line-height.

## Components Style
- Cards:
  - White background, 1px border #E2E8F0, radius 12px.
  - Light shadow only on hover.
- Buttons:
  - Primary: bg-primary text-white, radius 10px, medium padding.
  - Secondary: border + text-primary, transparent bg.
- Tables:
  - Simple rows with subtle divider lines.
  - Header with light background #F1F5F9.
- Nav:
  - Left sidebar for desktop, bottom nav for mobile.
  - Active item highlighted with primary color left border.

## Layout
- Dashboard layout:
  - Left sidebar navigation.
  - Top bar with user name, role, logout.
  - Main content area with cards and tables.
- Use plenty of whitespace; avoid crowded screens.

## Rules for AI
- Always read this DESIGN.md before generating or modifying UI.
- Use Tailwind classes that match this system (no random colors).
- Prefer simple, clean layouts over “fancy” effects.
- No glassmorphism, no heavy 3D, no crazy animations.