/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf3',
          100: '#d6fae1',
          200: '#aff3c6',
          300: '#79e7a3',
          400: '#3fd27a',
          500: '#18b85c',
          600: '#0c9549',
          700: '#0b753d',
          800: '#0d5c33',
          900: '#0c4c2c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
