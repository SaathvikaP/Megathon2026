import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Built around the FinGuard logo mint (#72C198 = brand-400).
        brand: {
          50: '#effaf4',
          100: '#d9f2e4',
          200: '#b6e4cb',
          300: '#8fd3af',
          400: '#72c198',
          500: '#4fa77b',
          600: '#3b8a63',
          700: '#2f6f51',
          800: '#285942',
          900: '#224a38',
          950: '#0f2a1f',
        },
        saffron: {
          50: '#fff8eb',
          100: '#ffecc6',
          200: '#ffd788',
          300: '#ffbc4a',
          400: '#ffa220',
          500: '#f98007',
          600: '#dd5b02',
          700: '#b73d06',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
