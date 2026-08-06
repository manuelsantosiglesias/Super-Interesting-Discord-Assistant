/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkbg: '#0B0F19',
        darkcard: '#161D30',
        darkborder: '#1F2A45',
        primary: '#5865F2', // Discord blurple
        primaryhover: '#4752C4',
        accent: '#248046', // Discord green
        accentred: '#DA373C' // Discord red
      }
    },
  },
  plugins: [],
}
