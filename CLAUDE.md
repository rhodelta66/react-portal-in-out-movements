# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Run development server on localhost:3000
- `npm run build` - Build for production to `build/` folder
- `npm run buildmin` - Build for production to `buildmin/` folder with no source maps
- `npm test` - Run tests in interactive watch mode

### Package Management
- `npm install` - Install dependencies

## Architecture

This is a React application built with Create React App for the Tracy identity/authentication service website.

### Core Structure
- **Entry Point**: `src/index.js` renders the App component with Bootstrap, custom SCSS, and Font Awesome styles
- **Main App**: `src/App.js` sets up React Router with routes and wraps everything in UserProvider context
- **Authentication Server**: Connects to `https://id.tracy.nu` for OAuth authentication

### Authentication System
The application uses a custom OAuth implementation:
- **UserContext** (`src/services/UserContext.js`): React Context provider managing user authentication state
- **OAuth Service** (`src/services/OAuth.js`): Handles OAuth flows, token management, and API calls
- **Authentication Flow**: Cookie-based token storage with refresh token support
- **User Management**: Signup, login, password reset, and account deletion functionality

### Component Structure
- **Layout Components**: Header, Footer, FooterInner provide site navigation and branding
- **Page Components**: Home (Diensten), Over-ons, Contact, Support are main site pages  
- **Account Components**: Login, Signup, User profile, ResetStep1/2, Delete located in `src/account/`
- **Utility Components**: Title, Forms (Input, Button, Errors), Blok, Person for reusable UI elements

### Routing
Uses React Router with exact path matching:
- `/` - Services page (Diensten)  
- `/support` - Support page
- `/over-ons` - About us page
- `/contact` - Contact page
- `/account/*` - Authentication pages (login, signup, user profile, password reset, delete)

### Styling
- **Bootstrap 5.1.3** for base styling
- **Custom SCSS** (`src/custom.scss`) for theme customization
- **Font Awesome 4.7.0** for icons
- Responsive design with mobile-first approach

### State Management
Centralized user authentication state through React Context, including:
- Authentication status and user claims
- Token management (access + refresh tokens)
- Admin role detection
- Error and success message handling
- OAuth state validation

### Key Dependencies
- React 16.8.6 with React Router DOM 5.0.1
- Bootstrap 5.1.3 + jQuery 3.4.1 + Popper.js
- node-sass for SCSS compilation
- Font Awesome for icons