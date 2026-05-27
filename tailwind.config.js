/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: '#0a0a0a',
        'bg-muted': '#f3f3f3',
        // Text
        primary: '#fafafa',
        'text-muted': '#8c8c8c',
        'text-inverse': '#0a0a0a',
        // Borders
        'border-muted': 'rgba(118,118,118,0.2)',
        // Brand accent — pick your own; warm amber works well on near-black
        accent: '#e8d4a0',
      },
      fontFamily: {
        sans: ['"General Sans"', 'system-ui', 'sans-serif'],
        display: ['"Melodrama"', '"General Sans"', 'serif'],
      },
      fontSize: {
        // Editorial scale — small body to hero-sized display
        xs: ['14px', { lineHeight: '20px' }],
        sm: ['16px', { lineHeight: '24px' }],
        base: ['18px', { lineHeight: '28px' }],
        lg: ['20px', { lineHeight: '30px' }],
        xl: ['30px', { lineHeight: '38px' }],
        '2xl': ['36px', { lineHeight: '44px' }],
        '3xl': ['56px', { lineHeight: '1.05' }],
        '4xl': ['80px', { lineHeight: '1' }],
        '5xl': ['102px', { lineHeight: '0.95' }],
      },
      spacing: {
        // 4-based scale matching your design.md
        '1': '4px',
        '2': '6px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '40px',
        '7': '48px',
        '8': '56px',
      },
      borderRadius: {
        xs: '50px',
        full: '9999px',
      },
      boxShadow: {
        'glow-up': '0 -10px 70px -5px rgba(0,0,0,0.15)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'in-out-quart': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      transitionDuration: {
        instant: '150ms',
        fast: '200ms',
        normal: '300ms',
        slow: '600ms',
      },
    },
  },
  plugins: [],
}
