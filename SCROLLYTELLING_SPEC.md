# Wafid Cochin between-section scrollytelling specification

This system preserves native scrolling. Scroll position is observed and mapped to transforms and opacity; wheel and touch input are never intercepted. The current production site uses a dependency-free implementation in `scripts.js` and `motion.css`. The GSAP examples below are migration blueprints for a future component build.

## Shared motion tokens

| Token | Value | Purpose |
| --- | --- | --- |
| Spatial easing | `cubic-bezier(.16, 1, .3, 1)` | Non-scrubbed entrances and releases |
| Scrub smoothing | `1.2` | GSAP ScrollTrigger catch-up without scroll locking |
| Portal scale | `1 → .94` | Outgoing chapter depth |
| Incoming offset | `44px → 0` | Incoming card arrival |
| Outgoing opacity | `1 → .62` | Depth separation without blur |
| Card bezel | `28px 28px 0 0` | Incoming chapter edge |
| Ambient warmth | `0 → .10` | Process chapter color grade |
| Ambient coolness | `0 → .08` | Contact chapter color grade |

Dynamic blur is intentionally omitted in production. Transform and opacity provide the same depth hierarchy without introducing a full-section repaint.

## 1. Pin and scale portal

Implemented between “The WAFID difference” and “Services.” The outgoing section is sticky only within `.portal-stack`, so it releases naturally when the incoming section finishes passing it.

| Progress | Outgoing chapter | Incoming chapter | Layering |
| --- | --- | --- | --- |
| 0% | Scale `1`, opacity `1` | `translate3d(0,44px,0)` | Outgoing `z:1`, incoming `z:2` |
| 25% | Scale `.985`, opacity `.905` | Y `33px` | Incoming bezel begins crossing viewport |
| 50% | Scale `.97`, opacity `.81` | Y `22px` | Incoming shadow establishes separation |
| 100% | Scale `.94`, opacity `.62` | Y `0` | Incoming section fully owns the viewport |

Mobile below 901px uses normal document flow; no section is pinned or transformed.

## 2. Ambient color grading

A fixed, pointer-transparent color-grade layer uses soft-light radial gradients. The strength is calculated from each chapter’s distance to the viewport centre.

| Progress | Warm layer | Cool layer | Page content |
| --- | --- | --- | --- |
| 0% | `0` | `0` | Original palette |
| 25% | `.025` | `.02` | Barely perceptible edge light |
| 50% | `.05` | `.04` | Transitional color grade |
| 100% | `.10` process / `.08` contact | Chapter-dependent | No background color snap |

The ambient layer is hidden under reduced-motion preference.

## 3. Sticky split and content wipe

Implemented in the process chapter. The left headline uses `position: sticky; top: 112px`; steps remain normal-flow content.

| Progress | Headline | Supporting steps | Exit |
| --- | --- | --- | --- |
| 0% | Enters in normal position | Step 01 approaches | No pin yet |
| 25% | Locks at `112px` | Step 01 crosses headline baseline | Heading remains fully opaque |
| 50% | Remains pinned | Step 02 replaces the visual focus | Step reveals use 720ms out-expo |
| 100% | Releases at section boundary | Step 03 clears | Next chapter wipes into normal flow |

The split collapses below 901px, avoiding sticky viewport and mobile address-bar issues.

## 4. Curtain and horizon reveal

The dark trust strip acts as the visual horizon between the hero and editorial content.

| Progress | Horizon strip | Hero depth | Shadow |
| --- | --- | --- | --- |
| 0% | Y `24px` | Hero remains dominant | Soft shadow begins below viewport |
| 25% | Y `18px` | Strip starts crossing boundary | Shadow opacity is fixed and subtle |
| 50% | Y `12px` | Equal visual ownership | No layout displacement |
| 100% | Y `0` | Strip settles into document | Normal section flow resumes |

Only `translate3d` changes. The strip’s document height and surrounding layout never change.

## 5. Chapter progress markers

Six chapter links form a translucent side pill on desktop and a bottom safe-area pill on mobile. IntersectionObserver uses a narrow centre band to determine the active chapter.

| Progress | Marker behaviour |
| --- | --- |
| 0% | Previous chapter remains active until the next chapter reaches the centre band |
| 25% | Incoming chapter approaches; no premature state change |
| 50% | Active link receives acid background and `aria-current="step"` |
| 100% | State remains stable until another chapter enters the centre band |

Markers are ordinary anchor links. They never control or lock scrolling.

## GSAP blueprint: pinned scale-over stack

```js
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduced) {
  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: '.portal-stack',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      invalidateOnRefresh: true,
    },
  });

  timeline
    .fromTo('.portal-stack .intro',
      { scale: 1, opacity: 1 },
      { scale: .94, opacity: .62, ease: 'none' }, 0)
    .fromTo('.portal-stack .services',
      { y: 44 },
      { y: 0, ease: 'none' }, 0);
}
```

The CSS owns `position: sticky`; ScrollTrigger only interpolates presentation values. No `pin: true` is required, which reduces pin-spacer and refresh complexity.

## GSAP blueprint: ambient background shift

```js
if (!reduced) {
  gsap.fromTo(document.documentElement,
    { '--ambient-warm': 0 },
    {
      '--ambient-warm': .10,
      ease: 'none',
      scrollTrigger: {
        trigger: '#process',
        start: 'top bottom',
        end: 'center center',
        scrub: 1.2,
      },
    });

  gsap.fromTo(document.documentElement,
    { '--ambient-cool': 0 },
    {
      '--ambient-cool': .08,
      ease: 'none',
      scrollTrigger: {
        trigger: '#contact',
        start: 'top bottom',
        end: 'center center',
        scrub: 1.2,
      },
    });
}
```

## Reduced-motion bypass

```js
const media = window.matchMedia('(prefers-reduced-motion: reduce)');

function configureMotion() {
  if (media.matches) {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    gsap.set('.portal-stack .intro, .portal-stack .services, .trust-strip', {
      clearProps: 'transform,opacity,willChange',
    });
    return;
  }
  // Initialise timelines here.
}

configureMotion();
media.addEventListener('change', configureMotion);
```

```css
@media (prefers-reduced-motion: reduce) {
  .portal-stack .intro {
    position: relative !important;
    min-height: auto;
    transform: none !important;
    opacity: 1 !important;
  }
  .portal-stack .services,
  .trust-strip {
    transform: none !important;
  }
  .ambient-wash {
    display: none;
  }
}
```

## Performance guardrails

- Native wheel and touch scrolling are never cancelled or replaced.
- Scroll listeners are passive and schedule at most one requestAnimationFrame.
- Only transform, opacity and CSS custom properties are updated while scrolling.
- Sticky positioning is scoped to dedicated wrappers without vertical overflow ancestors.
- `will-change` is added only during active scroll and removed 180ms after scrolling settles.
- Mobile uses `100svh` only where a full-height desktop chapter needs a stable fallback; sticky transitions collapse below 901px.
- The embedded map, text layout, section height, margins and offsets are never animated.
