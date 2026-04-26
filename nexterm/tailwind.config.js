/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#1a1d23',
          hover: '#22262e',
          active: '#2a2f38',
          border: '#2d3139',
        },
        accent: {
          DEFAULT: '#4A90D9',
          hover: '#5A9EE5',
          muted: '#4A90D930',
        },
        surface: {
          DEFAULT: '#1e2128',
          raised: '#252830',
          overlay: '#2c3038',
        },
        text: {
          primary: '#e4e6ea',
          secondary: '#9ca0a8',
          muted: '#6b7080',
        },
        danger: '#e5534b',
        success: '#57ab5a',
        warning: '#c69026',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
    },
  },
  plugins: [],
};
