# Wafid Cochin interaction choreography

The motion language is precise, calm and service-oriented. It borrows the perceived responsiveness of premium product sites without making a medical-travel assistance experience feel theatrical or difficult to use.

## Motion tokens

| Token | Value | Use |
| --- | --- | --- |
| Fast | 180 ms | Color, border and opacity feedback |
| Base | 360 ms | Hover lift, tilt reset and magnetic release |
| Slow | 720 ms | Section reveal and hero depth motion |
| Out quart | `cubic-bezier(.25, 1, .5, 1)` | Small UI state changes |
| Out expo | `cubic-bezier(.16, 1, .3, 1)` | Spatial transitions and entrances |
| Heavy response | `cubic-bezier(.16, 1, .3, 1)` | Icon lift with no overshoot |

Equivalent non-bouncy Framer Motion settings: cards use `stiffness: 420`, `damping: 44`, `mass: 0.9`, `bounce: 0`; magnetic release uses `stiffness: 500`, `damping: 48`, `mass: 0.7`, `bounce: 0`; modal sheets should use `stiffness: 260`, `damping: 34`, `mass: 0.95`, `bounce: 0`.

## Component states

### Service cards

- Rest: zero rotation, no elevation and action link at 72% opacity.
- Hover: maximum ±3° tilt, 8 px lift, cursor-centred 360 px radial glow and 24/54 px soft shadow.
- Focus-within: same elevation and glow as hover, giving keyboard users equivalent feedback.
- Press: linked action compresses to 98% for approximately 90 ms.
- Exit: rotation and elevation return over 360 ms with out-expo easing.

### Primary and secondary actions

- Rest: existing high-contrast pill or text-link treatment.
- Hover: magnetic displacement begins within 20 px of the target edge and is capped at 6 px.
- Focus: 2 px dark inner outline at 3 px offset, backed by a 5 px acid outer ring for contrast on light and dark surfaces.
- Press: 98% scale; release returns over 360 ms.
- Touch: no magnetic displacement; press compression remains available.
- Mobile service cards become a labelled, keyboard-focusable 80vw scroll-snap rail with a visible next-card edge and “Swipe to explore 01—06” cue.

### Hero and map media

- Hero document uses a maximum 20 px horizontal and 14 px vertical parallax field.
- Floating notes counter-move at 35–45% of the main document displacement.
- The hero hotspot exposes the guided booking-to-report idea without blocking content.
- The live map is never transformed; only its outer container receives a low-cost spotlight and border elevation.

### Contact action pills

- Rest: phone, email and address are fully visible semantic links with adjacent 48 px copy controls.
- Hover: the pill border brightens; each link participates in the 20 px magnetic field.
- Focus: dark inner outline plus acid outer ring retains contrast on both dark and light surfaces.
- Press: the activated link or copy control compresses to 98% for 90 ms.
- Copy success: a local `aria-live` tooltip displays “Copied” for 1.6 seconds; failure produces “Copy failed”.
- Mobile: each action remains at least 44 px tall and launches the native dialer, email client or maps app directly.

## Section transitions

Section labels and headline groups reveal over 720 ms using out-expo easing. Supporting copy enters from the right by 22 px. Scroll direction determines the vertical sign of standard reveals. Observers detach after the first reveal.

The process headline uses a restrained sticky rail on desktop while its three steps continue scrolling. Long synthetic pinning and card-to-modal morphing remain deferred because the current cards have no deep-dive content that justifies a modal.

## Vanilla implementation blueprints

The production implementation lives in `motion.css` and `scripts.js`. The reusable pattern is:

```css
.interactive-surface {
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));
  background-image: radial-gradient(360px circle at var(--mx) var(--my), rgba(217,255,95,.14), transparent 44%);
  transition: transform 360ms cubic-bezier(.16,1,.3,1);
}
```

```js
const x = event.clientX - rect.left;
const y = event.clientY - rect.top;
surface.style.setProperty('--mx', `${x}px`);
surface.style.setProperty('--my', `${y}px`);
surface.style.setProperty('--ry', `${((x / rect.width) - .5) * 6}deg`);
surface.style.setProperty('--rx', `${((y / rect.height) - .5) * -6}deg`);
```

For a future Framer Motion migration:

```jsx
<motion.a
  whileHover={{ y: -8 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 420, damping: 44, mass: 0.9, bounce: 0 }}
/>
```

GSAP/ScrollTrigger should be added only when a future content section genuinely needs pinning or timeline sequencing. It is unnecessary for ordinary reveal animations.

### Standalone magnetic-button blueprint

The 20 px attraction field is measured from the button's outer rectangle, so the effect begins before the cursor crosses the button edge:

```css
.magnetic {
  --mx: 0px;
  --my: 0px;
  transform: translate3d(var(--mx), var(--my), 0);
  transition: transform 360ms cubic-bezier(.16, 1, .3, 1);
}
.magnetic:active { transform: translate3d(var(--mx), var(--my), 0) scale(.98); }
```

```js
const button = document.querySelector('.magnetic');
document.addEventListener('pointermove', (event) => {
  const rect = button.getBoundingClientRect();
  const nearestX = Math.min(Math.max(event.clientX, rect.left), rect.right);
  const nearestY = Math.min(Math.max(event.clientY, rect.top), rect.bottom);
  const distance = Math.hypot(event.clientX - nearestX, event.clientY - nearestY);
  const strength = distance > 20 ? 0 : distance === 0 ? 1 : 1 - distance / 20;
  const dx = Math.min(Math.max((event.clientX - rect.left - rect.width / 2) * .08, -6), 6);
  const dy = Math.min(Math.max((event.clientY - rect.top - rect.height / 2) * .08, -6), 6);
  button.style.setProperty('--mx', `${dx * strength}px`);
  button.style.setProperty('--my', `${dy * strength}px`);
}, { passive: true });
```

### One-tap contact and copy blueprint

```html
<div class="contact-pill">
  <a href="tel:+918089434967">+91 80894 34967</a>
  <button type="button" data-copy="+918089434967" aria-label="Copy phone number">
    Copy <span role="status" aria-live="polite"></span>
  </button>
</div>

<a href="mailto:kinoshkochin2000@gmail.com?subject=WAFID%20Cochin%20inquiry">
  Email Wafid Cochin
</a>
```

```js
document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.querySelector('[role="status"]').textContent = 'Copied';
  });
});
```

## Performance and accessibility guardrails

- Pointer updates are consolidated with `requestAnimationFrame`.
- Each bounding rectangle is cached on pointer entry instead of read on every event.
- Motion writes CSS variables consumed by transforms or card-local gradient positioning.
- Passive pointer and scroll listeners avoid blocking the main thread.
- `will-change` exists only while a fine pointer is actively over an animated surface.
- The live Google Maps iframe is not transformed or blurred by motion code.
- Content is visible by default and hidden only after the `motion-ready` enhancement class is applied.
- Coarse pointers disable tilt, spotlight and magnetic movement.
- `prefers-reduced-motion: reduce` removes transitions, parallax, progress animation and reveal gating.
- Focus-visible styling and focus-within card states preserve keyboard parity.
- Escape and outside-click dismiss the mobile navigation.
