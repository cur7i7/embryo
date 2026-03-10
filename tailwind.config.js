/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        burgundy: '#672146',
        'burgundy-panel': '#562039',
        mesa: '#AA737D',
        cream: '#FFF7C7',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        accent: ['Cormorant Garamond', 'serif'],
        body: ['Public Sans', 'sans-serif'],
      },
      boxShadow: {
        exhibit: '0 22px 46px rgba(20, 4, 13, 0.45)',
        panel: '0 8px 24px rgba(20, 4, 13, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
