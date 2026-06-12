#!/usr/bin/env node
// Detects the laptop's LAN IPv4 address, exposes it to Supabase/Postgres URLs,
// and runs `next dev`. Use when you want to open the app from another device
// on the same network (phone, tablet, second laptop) without touching .env.local.

import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

function detectLanIp() {
   const ifaces = networkInterfaces();
   for (const list of Object.values(ifaces)) {
      for (const iface of list ?? []) {
         if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
         }
      }
   }
   return null;
}

const ip = detectLanIp();
if (!ip) {
   console.error('[dev:lan] Could not detect a LAN IPv4 address. Are you connected to a network?');
   process.exit(1);
}

console.log(`[dev:lan] LAN IP: ${ip}`);
console.log(`[dev:lan] App:        http://${ip}:3000`);
console.log(`[dev:lan] Supabase:   http://${ip}:54321`);
console.log(`[dev:lan] Open the second device's browser to http://${ip}:3000`);

const env = {
   ...process.env,
   NEXT_PUBLIC_SUPABASE_URL: `http://${ip}:54321`,
};

const child = spawn('next', ['dev', '--turbopack', '-H', '0.0.0.0'], {
   stdio: 'inherit',
   env,
   shell: false,
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
   console.error('[dev:lan] Failed to start next dev:', err);
   process.exit(1);
});
