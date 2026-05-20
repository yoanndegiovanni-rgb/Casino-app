/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt:   { DEFAULT: '#1a4a2a', dark: '#0d2e19', light: '#235c34' },
        gold:   { DEFAULT: '#d4af37', light: '#f0d060', dark: '#a08820' },
        casino: { bg: '#0a1a0f', card: '#0f2416' },
      },
      keyframes: {
        dealCard: {
          '0%':   { transform: 'translateY(-120px) translateX(120px) scale(0.5)', opacity: '0' },
          '100%': { transform: 'translateY(0) translateX(0) scale(1)', opacity: '1' },
        },
        flipCard: {
          '0%':   { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        chipDrop: {
          '0%':   { transform: 'translateY(-30px)', opacity: '0' },
          '60%':  { transform: 'translateY(4px)' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulse_gold: {
          '0%, 100%': { boxShadow: '0 0 8px #d4af37' },
          '50%':      { boxShadow: '0 0 24px #d4af37' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        chipWin: {
          '0%':   { transform: 'translateY(0) scale(1.2)', opacity: '1' },
          '80%':  { opacity: '1' },
          '100%': { transform: 'translateY(120px) scale(0.4)', opacity: '0' },
        },
        chipLose: {
          '0%':   { transform: 'translateY(0) scale(1.2)', opacity: '1' },
          '80%':  { opacity: '1' },
          '100%': { transform: 'translateY(-140px) scale(0.4)', opacity: '0' },
        },
        resultPop: {
          '0%':   { transform: 'scale(0.5)', opacity: '0' },
          '60%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'deal-card':   'dealCard 0.4s ease-out forwards',
        'flip-card':   'flipCard 0.5s ease-in-out forwards',
        'chip-drop':   'chipDrop 0.3s ease-out forwards',
        'pulse-gold':  'pulse_gold 1.5s ease-in-out infinite',
        'fade-in':     'fadeIn 0.3s ease-out forwards',
        'chip-win':    'chipWin 0.9s ease-in forwards',
        'chip-lose':   'chipLose 0.9s ease-in forwards',
        'result-pop':  'resultPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
    },
  },
  plugins: [],
};
