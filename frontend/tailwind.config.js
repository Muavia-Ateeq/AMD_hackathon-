/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        amd: {
          red:      '#B00010',   // deep crimson
          redHover: '#8C000C',   // even darker on hover
          redGlow:  '#E6001A',   // bright accent glow
          dark:     '#0A0A0A',   // near-black background
          surface:  '#111111',   // card surface
          border:   '#1E1E1E',   // subtle borders
          muted:    '#2A2A2A',   // hover states
          text:     '#E5E5E5',   // primary text
          sub:      '#888888',   // secondary text
        },
      },
    },
  },
  plugins: [],
}
