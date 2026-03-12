/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF3EB',
        sand: '#F0E8DC',
        lavender: '#EDE5F5',
        'warm-gray': '#E0D8CC',
        'text-primary': '#1A1512',
        'text-secondary': '#5A5048',
        'text-tertiary': '#A89B8E',
        'text-ghost': '#B5A99C',
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
