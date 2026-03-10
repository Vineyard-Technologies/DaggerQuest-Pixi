/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#111111',
        foreground: '#ffffff',
        primary: '#ffe7b0',
        secondary: '#181818ee',
      },
      fontFamily: {
        'cinzel': ['Cinzel', 'serif'],
        'grenze': ['Grenze', 'serif'],
      },
    },
  },
  plugins: [],
}