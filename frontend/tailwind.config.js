/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dce8ff',
          500: '#4f7cff',
          600: '#3d63e6',
          700: '#2d4db8',
          900: '#1a2d6e',
        },
      },
    },
  },
  plugins: [],
};
