export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: {
      base: '#0F1214', surface: '#171B1F', line: '#232A30',
      ink: '#E6EAED', muted: '#8A949C', accent: '#22D3EE',
      critical: '#EF4444', high: '#F97316', medium: '#F59E0B', resolved: '#22C55E',
      new_construction: '#EF4444', vegetation_loss: '#F97316', water_shrinkage: '#3B82F6', sand_mining: '#F59E0B',
    },
    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'ui-monospace', 'monospace'] },
    keyframes: {
      drift: { to: { backgroundPosition: '48px 48px' } },
      ping2: { '0%': { transform: 'scale(.6)', opacity: '.9' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
      slide: { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
    },
    animation: { drift: 'drift 6s linear infinite', ping2: 'ping2 1.8s ease-out infinite', slide: 'slide .15s ease-out' },
  } },
}
