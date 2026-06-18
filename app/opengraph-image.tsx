import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Greedy Pirate — push-your-luck pirate card game';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
   return new ImageResponse(
      (
         <div
            style={{
               width: '100%',
               height: '100%',
               display: 'flex',
               flexDirection: 'column',
               alignItems: 'center',
               justifyContent: 'center',
               background:
                  'radial-gradient(ellipse 70% 50% at 15% 20%, #2dd4bf55 0%, transparent 60%),' +
                  'radial-gradient(ellipse 60% 45% at 90% 35%, #8b3df080 0%, transparent 60%),' +
                  'radial-gradient(ellipse 55% 40% at 70% 95%, #ff3b8a55 0%, transparent 65%),' +
                  '#02060f',
               color: '#f4e7c3',
               fontFamily: 'serif',
               padding: 64,
            }}
         >
            <div
               style={{
                  fontSize: 160,
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(180deg, #fde68a 0%, #f59e0b 60%, #b45309 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                  textShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  lineHeight: 1,
               }}
            >
               Greedy Pirate
            </div>
            <div
               style={{
                  marginTop: 24,
                  fontSize: 36,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#5eead4',
               }}
            >
               Fortune favors the bold
            </div>
            <div
               style={{
                  marginTop: 48,
                  fontSize: 28,
                  color: '#f4e7c3cc',
                  textAlign: 'center',
                  maxWidth: 900,
               }}
            >
               Push-your-luck pirate card game. Draw gold, bank your loot, beware the pirates.
            </div>
         </div>
      ),
      { ...size },
   );
}
