/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        cream: {
          50: '#FAF9F6',
          100: '#F8F7F2',
          200: '#F3EFE6',
          300: '#EAE5D9',
          400: '#DDD6C7',
        },
        forest: {
          50: '#F0F5F1',
          100: '#E2EBE2',
          200: '#C9D8C9',
          500: '#557A60',
          600: '#45644F',
          700: '#385240',
          800: '#2C3E33',
          900: '#1C251E',
        },
        brand: {
          50: '#F0F5F1',
          100: '#E2EBE2',
          500: '#557A60',
          600: '#45644F',
          700: '#385240',
          800: '#2C3E33',
          900: '#1C251E',
        },
      },
    },
  },
  plugins: [],
};
