# PrimeNG v20 Dark Glass Morphism Theme

This theme provides a custom dark glass morphism preset for PrimeNG v20 that matches the app's design system using the proper PrimeNG v20 theme configuration system.

## Features

- **Dark Glass Morphism Design**: Matches the app's dark theme with glass effects
- **Purple/Indigo Accent Colors**: Uses the app's primary color scheme (#6366f1 to #8b5cf6)
- **Consistent Styling**: All PrimeNG components styled to match the app's design language
- **Smooth Animations**: Consistent transitions and hover effects
- **Backdrop Blur Effects**: Modern glass morphism with blur effects
- **PrimeNG v20 Compatible**: Uses the official theme configuration system

## Usage

The theme is configured in `app.config.ts` using `providePrimeNG` with the `theme.preset` property. All PrimeNG components will use this theme by default.

## Customized Components

### Buttons
- Primary buttons with gradient background
- Secondary buttons with glass effect
- Outlined and text button variants
- Hover animations with transform effects

### Inputs
- Dark background with glass borders
- Focus states with primary color
- Consistent border radius and transitions

### Cards
- Glass morphism background
- Hover effects with elevation
- Consistent padding and typography

### Dialogs
- Glass morphism overlay
- Consistent header, content, and footer styling
- Smooth animations

### Dropdowns & Multiselect
- Glass morphism panels
- Consistent item styling
- Hover and selection states

### Tables
- Glass morphism headers and footers
- Hover effects on rows
- Consistent borders and typography

### Other Components
- Checkboxes with custom styling
- Dividers with glass effect
- Toast notifications with status colors
- Progress bars with gradient
- Sliders with custom handles
- Calendar with glass morphism
- Menus with glass effect
- Tooltips with backdrop blur

## CSS Variables

The preset uses CSS variables that match the app's design system:

```scss
--primary-color: #6366f1
--accent-color: #8b5cf6
--surface-ground: #0a0b0d
--surface-section: #141518
--surface-card: rgba(255, 255, 255, 0.02)
--surface-overlay: #1e1f23
--surface-border: rgba(255, 255, 255, 0.08)
--text-color: #ffffff
--text-color-secondary: #b4b8c0
--text-color-muted: #8b8f98
```

## Customization

To customize the theme:

1. Edit `primeng-theme.ts`
2. Modify CSS variables in the `cssVars` object
3. Update component-specific styles in the `rules` object

## Glass Effect Class

Use the `.glass-effect` class to apply backdrop blur to custom components:

```html
<div class="glass-effect">
  <!-- Your content -->
</div>
```

## Configuration

The theme is configured in `app.config.ts`:

```typescript
import { providePrimeNG } from 'primeng/config';
import { customDarkTheme } from '../styles/primeng-theme';

export const appConfig: ApplicationConfig = {
  providers: [
    providePrimeNG({
      theme: {
        preset: customDarkTheme
      }
    })
  ]
};
```

## Browser Support

- Modern browsers with backdrop-filter support
- Fallback for older browsers (no blur effect)
- WebKit scrollbar styling included

## PrimeNG v20 Compatibility

This theme uses the official PrimeNG v20 theme configuration system with `definePreset` from `@primeuix/themes`.
