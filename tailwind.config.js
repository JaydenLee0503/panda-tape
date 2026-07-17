/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        mat: '#14724A',
        accent: '#F2E14C',
        link: '#17A45B',
        'link-hover': '#0F8547',
        ink: '#23281F',
        paper: '#FBFAF4',
        card: '#FFFFFF',
        'card-off': '#FFFDF4',
        muted: '#8D897B',
        'muted-2': '#6A675C',
        'muted-3': '#B7B1A0',
        'card-border': '#ECE7D8',
        'card-border-2': '#F0ECDE',
      },
      fontFamily: {
        display: ['"Young Serif"', 'serif'],
        body: ['"Source Serif 4"', 'Georgia', 'serif'],
        script: ['"Pinyon Script"', 'cursive'],
        hand: ['"Caveat"', 'cursive'],
        sans: ['-apple-system', '"Helvetica Neue"', 'sans-serif'],
        mono: ['ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
