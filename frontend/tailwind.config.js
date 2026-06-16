/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#0a0a0f',
          900: '#111118',
          800: '#1c1c26',
          700: '#2a2a38',
          600: '#44445a',
          500: '#6b6b85',
          400: '#9494aa',
          300: '#c2c2d4',
          200: '#dcdce8',
          100: '#f0f0f6',
        },
      },
    },
  },
  plugins: [],
};
