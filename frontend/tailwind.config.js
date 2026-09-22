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
        // Soft Blue + Sage Green visual identity
        sage: {
          50: '#F5FAF8',   // Main Background
          100: '#D4E9DF',  // Light Sage
          200: '#BDDEC0',
          300: '#A4D0BA',
          400: '#8FBFA6',
          500: '#78A98F',  // Primary Sage
          600: '#5A9175',
          700: '#3F795F',  // Deep Sage
          800: '#2A5643',
          900: '#173A2C',  // Primary Text
        },
        softblue: {
          50: '#F5FBFD',
          100: '#E4F2F4',  // Pale Blue
          200: '#B9DDE3',  // Soft Blue
          300: '#91CAD4',
          400: '#64B2C0',
          500: '#4D9AA7',
          600: '#367C88',  // Deep Teal
          700: '#28606A',
          800: '#1D454C',
          900: '#132F34',
        },
        slateText: {
          primary: '#173A2C',   // Primary Text
          secondary: '#667875', // Secondary Text
        },
        borderTheme: '#DCE7E2',
        
        // Legacy aliases mapped to the new palette for backward compatibility
        brand: {
          50: '#F5FAF8',
          100: '#D4E9DF',
          200: '#B9DDE3',
          500: '#78A98F',
          600: '#3F795F',
          700: '#367C88',
          800: '#2A5643',
          900: '#173A2C',
        },
        forest: {
          50: '#F5FAF8',
          100: '#D4E9DF',
          200: '#B9DDE3',
          500: '#78A98F',
          600: '#3F795F',
          700: '#367C88',
          800: '#2A5643',
          900: '#173A2C',
        },
        cream: {
          50: '#FBFDFB',
          100: '#F5FAF8',
          200: '#EDF5F2',
          300: '#E4F0EC',
          400: '#DCE7E2',
        }
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 2s infinite linear',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
