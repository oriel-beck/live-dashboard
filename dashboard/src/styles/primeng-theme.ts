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
      950: '{indigo.950}'
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
          950: '#9a9bae'
        },
        
        // Primary color configuration for dark mode
        primary: {
          color: '#6366f1',
          inverseColor: '#ffffff',
          hoverColor: '#8b5cf6',
          activeColor: '#7c3aed'
        },
        
        // Highlight configuration for dark mode
        highlight: {
          background: 'rgba(99, 102, 241, 0.16)',
          focusBackground: 'rgba(99, 102, 241, 0.24)',
          color: 'rgba(255, 255, 255, 0.87)',
          focusColor: 'rgba(255, 255, 255, 0.87)'
        },
        
        // Form field configuration
        formField: {
          hoverBorderColor: '{primary.color}',
          focusBorderColor: '{primary.color}',
          background: '{surface.100}',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          color: '{surface.0}',
          placeholderColor: 'rgba(255, 255, 255, 0.5)'
        }
      }
    },
    
    // Focus ring configuration
    focusRing: {
      width: '3px',
      style: 'solid',
      color: 'rgba(99, 102, 241, 0.2)',
      offset: '2px'
    }
  },
  
  // Extended custom tokens
  extend: {
    glass: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: 'rgba(255, 255, 255, 0.08)',
      blur: 'blur(20px)'
    },
    shadows: {
      sm: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      md: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
      lg: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
    },
    transitions: {
      fast: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)'
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
    
    /* Button customizations */
    .p-button {
      border-radius: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 500;
      border: 1px solid transparent;
    }
    
    .p-button.p-button-primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-color: transparent;
      box-shadow: ${dt('shadows.md')};
    }
    
    .p-button.p-button-primary:hover {
      transform: translateY(-2px);
      box-shadow: ${dt('shadows.lg')};
    }
    
    .p-button.p-button-secondary {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border-color: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
    
    .p-button.p-button-secondary:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }
    
    .p-button.p-button-outlined {
      background: transparent;
      border-color: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-button.p-button-outlined:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: #6366f1;
      color: #ffffff;
    }
    
    .p-button.p-button-text {
      background: transparent;
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-button.p-button-text:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    
    /* Card customizations */
    .p-card {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      box-shadow: ${dt('shadows.md')};
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .p-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: ${dt('shadows.lg')};
      transform: translateY(-2px);
    }
    
    .p-card .p-card-title {
      color: #ffffff;
      font-weight: 600;
    }
    
    .p-card .p-card-content {
      color: rgba(255, 255, 255, 0.7);
    }
    
    /* Dialog customizations */
    .p-dialog {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      box-shadow: ${dt('shadows.lg')};
    }
    
    .p-dialog .p-dialog-header {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px 16px 0 0;
    }
    
    .p-dialog .p-dialog-title {
      color: #ffffff;
      font-weight: 600;
    }
    
    .p-dialog .p-dialog-content {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-dialog .p-dialog-footer {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0 0 16px 16px;
    }
    
    /* Dropdown customizations */
    .p-dropdown {
      background: #141518;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      color: #ffffff;
    }
    
    .p-dropdown-panel {
      background: #1e1f23;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      box-shadow: ${dt('shadows.lg')};
    }
    
    .p-dropdown-items .p-dropdown-item {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-dropdown-items .p-dropdown-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    
    .p-dropdown-items .p-dropdown-item.p-highlight {
      background: #6366f1;
      color: #ffffff;
    }
    
    /* Checkbox customizations */
    .p-checkbox .p-checkbox-box {
      background: #141518;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
    }
    
    .p-checkbox .p-checkbox-box.p-highlight {
      background: #6366f1;
      border-color: #6366f1;
    }
    
    /* Table customizations */
    .p-datatable .p-datatable-header {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px 12px 0 0;
    }
    
    .p-datatable .p-datatable-thead > tr > th {
      background: #141518;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: #ffffff;
      font-weight: 600;
    }
    
    .p-datatable .p-datatable-tbody > tr {
      background: transparent;
      transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .p-datatable .p-datatable-tbody > tr:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .p-datatable .p-datatable-tbody > tr > td {
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-datatable .p-datatable-footer {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0 0 12px 12px;
    }
    
    /* Paginator customizations */
    .p-paginator {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
    }
    
    .p-paginator .p-paginator-pages .p-paginator-page {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-paginator .p-paginator-pages .p-paginator-page:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    
    .p-paginator .p-paginator-pages .p-paginator-page.p-highlight {
      background: #6366f1;
      border-color: #6366f1;
      color: #ffffff;
    }
    
    /* Menu customizations */
    .p-menu {
      background: #1e1f23;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      box-shadow: ${dt('shadows.lg')};
    }
    
    .p-menu .p-menuitem-link {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-menu .p-menuitem-link:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    
    .p-menu .p-menuitem-link.p-menuitem-link-active {
      background: #6366f1;
      color: #ffffff;
    }
    
    /* Tooltip customizations */
    .p-tooltip .p-tooltip-text {
      background: #1e1f23;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      color: #ffffff;
      box-shadow: ${dt('shadows.md')};
    }
    
    /* Progress bar customizations */
    .p-progressbar {
      background: #141518;
      border-radius: 12px;
    }
    
    .p-progressbar .p-progressbar-value {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 12px;
    }
    
    /* Rating customizations */
    .p-rating .p-rating-item .p-rating-icon {
      color: rgba(255, 255, 255, 0.5);
    }
    
    .p-rating .p-rating-item .p-rating-icon.p-rating-icon-active {
      color: #6366f1;
    }
    
    /* Slider customizations */
    .p-slider {
      background: #141518;
    }
    
    .p-slider .p-slider-range {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    }
    
    .p-slider .p-slider-handle {
      background: #6366f1;
      border: 2px solid #6366f1;
    }
    
    .p-slider .p-slider-handle:hover {
      background: #8b5cf6;
      border-color: #8b5cf6;
    }
    
    /* Calendar customizations */
    .p-calendar {
      background: #141518;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      color: #ffffff;
    }
    
    .p-calendar .p-datepicker {
      background: #1e1f23;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      box-shadow: ${dt('shadows.lg')};
    }
    
    .p-calendar .p-datepicker .p-datepicker-header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .p-calendar .p-datepicker .p-datepicker-calendar .p-datepicker-today > span {
      background: #6366f1;
      color: #ffffff;
    }
    
    .p-calendar .p-datepicker .p-datepicker-calendar .p-datepicker-day {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .p-calendar .p-datepicker .p-datepicker-calendar .p-datepicker-day:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    
    .p-calendar .p-datepicker .p-datepicker-calendar .p-datepicker-day.p-highlight {
      background: #6366f1;
      color: #ffffff;
    }
    
    /* Loading overlay */
    .p-component-overlay {
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
    }
    
    /* Toast customizations */
    .p-toast .p-toast-message {
      background: ${dt('glass.background')};
      backdrop-filter: ${dt('glass.blur')};
      border: 1px solid ${dt('glass.border')};
      border-radius: 12px;
      box-shadow: ${dt('shadows.lg')};
    }
    
    .p-toast .p-toast-message.p-toast-message-success {
      border-left: 4px solid #10b981;
    }
    
    .p-toast .p-toast-message.p-toast-message-warn {
      border-left: 4px solid #f59e0b;
    }
    
    .p-toast .p-toast-message.p-toast-message-error {
      border-left: 4px solid #ef4444;
    }
    
    .p-toast .p-toast-message.p-toast-message-info {
      border-left: 4px solid #6366f1;
    }
  `
});
