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
    
    // Dark mode color scheme
    colorScheme: {
      dark: {
        // Surface colors for dark glass morphism
        surface: {
          0: 'rgba(255, 255, 255, 0.02)',
          50: '#0a0b0d',
          100: '#141518',
          200: '#1e1f23',
          300: '#2a2b30',
          400: '#3a3b42',
          500: '#4a4b54',
          600: '#5a5b66',
          700: '#6a6b78',
          800: '#7a7b8a',
          900: '#8a8b9c',
          950: '#9a9bae',
        },
        
        // Primary color configuration for dark mode
        primary: {
          color: '#6366f1',
          inverseColor: '#ffffff',
          hoverColor: '#8b5cf6',
          activeColor: '#7c3aed',
        },
        
        // Highlight configuration for dark mode
        highlight: {
          background: 'rgba(99, 102, 241, 0.16)',
          focusBackground: 'rgba(99, 102, 241, 0.24)',
          color: 'rgba(255, 255, 255, 0.87)',
          focusColor: 'rgba(255, 255, 255, 0.87)',
        },
      },
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
    
    /* Multi-select styling for Discord theme */
    .p-multiselect {
      background: #2f3136 !important;
      border: 1px solid #4f545c !important;
      color: #ffffff !important;
    }
    
    .p-multiselect-label {
      color: #ffffff !important;
    }
    
    .p-multiselect-label-container {
      color: #ffffff !important;
    }
    
    .p-multiselect-panel {
      background: #2f3136 !important;
      border: 1px solid #4f545c !important;
      color: #ffffff !important;
    }
    
    .p-multiselect-items {
      background: #2f3136 !important;
    }
    
    .p-multiselect-item {
      color: #ffffff !important;
      background: transparent !important;
    }
    
    .p-multiselect-item:hover {
      background: #4f545c !important;
    }
    
    .p-multiselect-item:focus {
      background: #5865f2 !important;
    }
    
    .p-multiselect-item.p-highlight {
      background: #5865f2 !important;
      color: #ffffff !important;
    }
    
    .p-multiselect-item-group {
      color: #b9bbbe !important;
      background: #36393f !important;
    }
    
    .p-multiselect-filter-container {
      background: #2f3136 !important;
      border-bottom: 1px solid #4f545c !important;
    }
    
    .p-multiselect-filter {
      background: #36393f !important;
      border: 1px solid #4f545c !important;
      color: #ffffff !important;
    }
    
    .p-multiselect-filter::placeholder {
      color: #b9bbbe !important;
    }
    
    .p-multiselect-token {
      background: #5865f2 !important;
      color: #ffffff !important;
    }
    
    .p-multiselect-token-label {
      color: #ffffff !important;
    }
    
    .p-multiselect-token-icon {
      color: #ffffff !important;
    }
  `,
});
