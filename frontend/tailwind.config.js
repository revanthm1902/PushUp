/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",   // 👈 important so Tailwind scans your React files
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
