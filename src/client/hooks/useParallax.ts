'use client';

import { useEffect, useRef } from 'react';

/**
 * Smoothed parallax offset in [-1, 1] driven by pointer position (desktop)
 * and device tilt (mobile browsers). iOS requires a permission call from a
 * user gesture, so we piggyback on the first tap — denied or unsupported
 * silently falls back to pointer/idle motion. Reduced-motion users get a
 * permanently centered value.
 *
 * Writes transforms directly to registered elements via rAF (no re-renders).
 * Each target declares its depth in px via data attributes.
 */
export function useParallax() {
   const targetsRef = useRef<Set<HTMLElement>>(new Set());

   useEffect(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      let goalX = 0;
      let goalY = 0;
      let curX = 0;
      let curY = 0;
      let raf = 0;
      let running = false;

      const tick = () => {
         curX += (goalX - curX) * 0.06;
         curY += (goalY - curY) * 0.06;
         for (const el of targetsRef.current) {
            const dx = Number(el.dataset.depthX ?? 0);
            const dy = Number(el.dataset.depthY ?? 0);
            el.style.transform = `translate3d(${(curX * dx).toFixed(2)}px, ${(curY * dy).toFixed(2)}px, 0)`;
         }
         if (Math.abs(goalX - curX) + Math.abs(goalY - curY) > 0.002) {
            raf = requestAnimationFrame(tick);
         } else {
            running = false;
         }
      };
      const kick = () => {
         if (!running) {
            running = true;
            raf = requestAnimationFrame(tick);
         }
      };

      const onPointer = (e: PointerEvent) => {
         goalX = (e.clientX / window.innerWidth) * 2 - 1;
         goalY = (e.clientY / window.innerHeight) * 2 - 1;
         kick();
      };

      const onTilt = (e: DeviceOrientationEvent) => {
         if (e.gamma == null || e.beta == null) return;
         // gamma: left/right tilt, beta: front/back. Clamp to ±15°.
         goalX = Math.max(-1, Math.min(1, e.gamma / 15));
         goalY = Math.max(-1, Math.min(1, (e.beta - 40) / 15)); // ~40° = natural hold
         kick();
      };

      const enableTilt = () => window.addEventListener('deviceorientation', onTilt);

      // iOS hides DeviceOrientationEvent entirely on insecure (http) pages,
      // so never reference the global bare — feature-detect via window.
      const OrientationEvent = (
         window as unknown as {
            DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
         }
      ).DeviceOrientationEvent;
      // iOS 13+: permission must be requested inside a user gesture.
      const iosRequest = OrientationEvent?.requestPermission;
      const onFirstTap = () => {
         iosRequest!.call(OrientationEvent)
            .then((state) => {
               if (state === 'granted') enableTilt();
            })
            .catch(() => {});
         window.removeEventListener('pointerdown', onFirstTap);
      };

      window.addEventListener('pointermove', onPointer);
      if (typeof iosRequest === 'function') {
         window.addEventListener('pointerdown', onFirstTap);
      } else if (OrientationEvent) {
         enableTilt();
      }

      return () => {
         cancelAnimationFrame(raf);
         window.removeEventListener('pointermove', onPointer);
         window.removeEventListener('pointerdown', onFirstTap);
         window.removeEventListener('deviceorientation', onTilt);
      };
   }, []);

   /** Ref callback registering an element as a parallax target. */
   return (el: HTMLElement | null) => {
      if (el) targetsRef.current.add(el);
   };
}
