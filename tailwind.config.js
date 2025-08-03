import colors from 'tailwindcss/colors'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zinc: colors.zinc,
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
