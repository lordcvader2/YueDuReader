/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7ff',
          100: '#bae7ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#1890ff',
          600: '#096dd9',
          700: '#0050b3',
          800: '#003a8c',
          900: '#002766',
        },
        reader: {
          light: '#ffffff',
          lightAlt: '#f5f5f5',
          sepia: '#f5f0e1',
          dark: '#1e1e1e',
          darkAlt: '#2d2d2d',
        }
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'SimSun', 'serif'],
        sans: ['Noto Sans SC', 'Source Han Sans SC', 'Source Han Sans CN', 'Microsoft YaHei', 'PingFang SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
