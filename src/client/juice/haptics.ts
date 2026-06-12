/**
 * Vibration wrapper. iOS Safari has never implemented navigator.vibrate,
 * so on iPhone every call is a silent no-op — Android Chrome gets real
 * buzzes for free. No settings UI; there's nothing to toggle on iOS.
 */
const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const haptics = {
   /** Light tick — gold draw, your-turn, button press. */
   tap(): void {
      if (canVibrate) navigator.vibrate(10);
   },
   /** Double pulse — successful bank. */
   success(): void {
      if (canVibrate) navigator.vibrate([12, 40, 24]);
   },
   /** Heavy rumble — pirate drawn. */
   heavy(): void {
      if (canVibrate) navigator.vibrate([45, 40, 60]);
   },
};
