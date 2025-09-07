import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const customDarkTheme = definePreset(Aura, {
  semantic: {
    // Primary color palette using indigo
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },

    // Focus ring configuration
    focusRing: {
      width: '3px',
      style: 'solid',
      color: 'rgba(99, 102, 241, 0.2)',
      offset: '2px',
    },
  },

  // Extended custom tokens
  extend: {
    glass: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: 'rgba(255, 255, 255, 0.08)',
      blur: 'blur(20px)',
    },
    shadows: {
      sm: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      md: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
      lg: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
    },
    transitions: {
      fast: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  components: {
    checkbox: {
      colorScheme: {
        dark: {
          root: {
            background: '#36393f',
          }
        }
      }
    }
  },

  // Additional CSS for glass effects and custom styling
  css: ({ dt }) => `
    /* Glass effect utility class */
    .glass-effect {
      background: ${dt('glass.background')};
      backdrop-filter: ${dt('glass.blur')};
      -webkit-backdrop-filter: ${dt('glass.blur')};
      border: 1px solid ${dt('glass.border')};
    }
    
    /* Custom scrollbar styling */
    .p-component::-webkit-scrollbar {
      width: 8px;
    }
    
    .p-component::-webkit-scrollbar-track {
      background: #141518;
    }
    
    .p-component::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
    }
    
    .p-component::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  `,
});
