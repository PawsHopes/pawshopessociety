/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brandOrange: '#ea580c',
        brandGreen: '#15803d',
        brandAmber: '#f59e0b',
        brandBlue: '#0ea5e9',
      },
    },
  },
  plugins: [],
};
