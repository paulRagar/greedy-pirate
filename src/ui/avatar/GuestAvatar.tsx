/**
 * Skull placeholder for signed-out / anonymous players — the pirate take
 * on the standard gray default-avatar silhouette.
 * Single-path silhouette: parents tint via translucent currentColor, so
 * overlapping shapes would double-paint and show seams.
 */
export function GuestAvatar({ className }: { className?: string }) {
   return (
      <svg viewBox='0 0 48 48' className={className} fill='currentColor' aria-hidden='true'>
         <g transform='translate(24 24) scale(1.12) translate(-24 -19)'>
            {/* one path: round cranium (r15) flowing into a narrower squared jaw */}
            <path d='M15 28 A15 15 0 1 1 33 28 L33 32.5 Q33 37 28.5 37 L19.5 37 Q15 37 15 32.5 Z' />
            {/* sockets, nose, mouth slits — carved out */}
            <g fill='var(--color-abyss-950)'>
               <ellipse cx='17.8' cy='16.4' rx='4.1' ry='4.9' transform='rotate(-8 17.8 16.4)' />
               <ellipse cx='30.2' cy='16.4' rx='4.1' ry='4.9' transform='rotate(8 30.2 16.4)' />
               <path d='M24 22 C25.1 24 25.9 25.6 25.6 26.8 L22.4 26.8 C22.1 25.6 22.9 24 24 22 Z' />
               <rect x='18.6' y='30' width='1.6' height='5.4' rx='0.8' />
               <rect x='21.7' y='30.4' width='1.6' height='5.8' rx='0.8' />
               <rect x='24.8' y='30.4' width='1.6' height='5.8' rx='0.8' />
               <rect x='27.9' y='30' width='1.6' height='5.4' rx='0.8' />
            </g>
         </g>
      </svg>
   );
}
