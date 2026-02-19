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
        "primary": "#137fec",
        "corporate": "#0f172a",
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        "success": "#2e7d32",
        "danger": "#d32f2f",
      },
      fontFamily: {
        "display": ["Lexend", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem", // Added for consistency with designs
        "3xl": "1.5rem", // Added for consistency with designs
        "full": "9999px"
      },
    },
  },
  plugins: [],
}
