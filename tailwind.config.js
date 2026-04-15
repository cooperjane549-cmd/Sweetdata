/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          red: '#FF3131',
        },
        gold: '#FFD700',
      },
    },
  },
  plugins: [],
}
