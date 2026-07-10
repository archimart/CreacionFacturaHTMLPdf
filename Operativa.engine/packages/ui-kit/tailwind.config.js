// tailwind.config.js
module.exports = {
  content: [
    "./**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        engine: {
          primary: "#3b82f6",
          secondary: "#64748b",
          accent: "#f59e0b",
        }
      }
    },
  },
  plugins: [],
}
