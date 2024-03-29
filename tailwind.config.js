/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
   content: ['./app/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
   darkMode: 'class',
   theme: {
      extend: {},
   },
   plugins: [
      plugin(function ({ addBase, theme }) {
         addBase({
            h1: { fontSize: theme('fontSize.2xl') },
            h2: { fontSize: theme('fontSize.xl') },
            h3: { fontSize: theme('fontSize.lg') },
         });
      }),
   ],
};
