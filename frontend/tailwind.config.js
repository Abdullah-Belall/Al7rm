/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#F5BD02',
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#F5BD02',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      boxShadow: {
        'gold': '0 4px 6px -1px rgba(245, 189, 2, 0.3), 0 2px 4px -1px rgba(245, 189, 2, 0.2)',
        'gold-md': '0 10px 15px -3px rgba(245, 189, 2, 0.3), 0 4px 6px -2px rgba(245, 189, 2, 0.2)',
        'gold-lg': '0 20px 25px -5px rgba(245, 189, 2, 0.3), 0 10px 10px -5px rgba(245, 189, 2, 0.2)',
      },
    },
  },
  plugins: [],
}

