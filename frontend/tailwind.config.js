/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'pixel': ['Orbitron', 'monospace'],
        'fantasy': ['MedievalSharp', 'serif'],
      },
      colors: {
        'rpg': {
          'dark': '#1a1a2e',
          'purple': '#16213e',
          'blue': '#0f3460',
          'gold': '#ffd700',
          'light': '#f5f5f5',
        }
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'bounce-slow': 'bounce 3s infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { 'box-shadow': '0 0 5px rgba(233, 69, 96, 0.5)' },
          '100%': { 'box-shadow': '0 0 20px rgba(233, 69, 96, 0.8), 0 0 30px rgba(233, 69, 96, 0.6)' }
        }
      }
    },
  },
  plugins: [],
}