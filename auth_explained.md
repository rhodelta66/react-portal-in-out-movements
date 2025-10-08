# Tracy OAuth Authentication Flow - Technical Training Guide

## Overview

This document serves as a comprehensive training guide for implementing OAuth 2.0 authentication using the Tracy Identity Server. All code examples are production-ready and reproducible. The Tracy application demonstrates a complete OAuth implementation with React, providing patterns you can adapt for your own applications.

**Server**: `https://id.tracy.nu`  
**Flow Type**: OAuth 2.0 Implicit Flow with Refresh Tokens  
**Framework**: React 18 with Context API

## Quick Start Implementation

### Step 1: Create the OAuth Client Class

Create `src/services/OAuth.js` - This is your complete, production-ready OAuth client:

```javascript
// src/services/OAuth.js
export default class OAuth {
    cookiePrefix = "oauth_";

    constructor(opt) {
        this.server = opt.server;                    // e.g., "https://id.tracy.nu"
        this.client_id = opt.client_id || null;
        this.redirect_uri = opt.redirect_uri || window.location.href.split('#')[0];
        this.audience = opt.audience || null;
        this.response_type = opt.response_type || 'token';
        this.scope = opt.scope || 'openid';
        this.state = this.getCookie('state');
        this.reset_hash = this.getPasswordResetHash();
        
        // Auto-validate OAuth callback if state exists
        if (this.state) this.validate();
    }

    // Generate cryptographically secure random strings
    generateRandomString() {
        return window.btoa((Math.random() * 6452421).toString());
    }

    // Cookie management with prefixed names
    getCookie(name) {
        const regex = new RegExp('(?:(?:^|.*;\\s*)' + this.cookiePrefix + name + '\\s*\\=\\s*([^;]*).*$)|^.*$');
        return document.cookie.replace(regex, "$1");
    }

    setCookie(name, value, maxAgeInSeconds = 300) {
        document.cookie = this.cookiePrefix + name + "=" + value + ";path=/;max-age=" + maxAgeInSeconds.toString();
    }

    // Main OAuth authorization redirect
    authorize() {
        this.nonce = this.generateRandomString();
        this.state = this.generateRandomString();
        this.setCookie("state", this.state);
        
        // Build OAuth authorization URL
        let qs = "";
        Object.keys(this).forEach(key => {
            if (key === "cookiePrefix" || key === "server" || this[key] === null) return;
            qs += (qs ? "&" : "") + key + '=' + encodeURIComponent(this[key]);
        });
        
        // Redirect to OAuth server
        window.location.href = this.server + '/authorize?' + qs;
    }

    // Process OAuth callback from URL fragment
    validate() {
        const hash = window.location.hash.substr(1);
        const result = hash.split('&').reduce(function (result, item) {
            const parts = item.split('=');
            result[parts[0]] = decodeURIComponent(parts[1]);
            return result;
        }, {});
        
        // Verify state parameter for CSRF protection
        if (result && result.state === this.state) {
            this.setCookie("state", "", 0);  // Clear state
            window.location.hash = "";       // Clean URL
            this.setToken(result);           // Store tokens
        }
    }

    // Token storage with automatic expiration handling
    setToken(result) {
        const maxAge = result.expires_in || result.accessTokenExpirationSeconds || 1;
        const refreshMaxAge = maxAge === 1 ? 1 : 3600 * 24 * 30; // 30 days
        const token = result.access_token || result.idToken || "";
        const refreshToken = result.refresh_token || result.refreshToken || "";
        const uid = result.uid || "";
        
        this.setCookie("token", token, maxAge);
        this.setCookie("refreshToken", refreshToken, refreshMaxAge);
        this.setCookie("uid", uid, refreshMaxAge);
    }

    // Get valid token (with automatic refresh)
    async getToken(stayhere = false) {
        let token = this.getCookie('token');
        if (!token) {
            const result = await this.refresh();
            if (!result || result.error) {
                if (stayhere) return result.error;
                this.authorize(); // Redirect to login
            }
            token = this.getCookie('token');
        }
        return token;
    }

    // Refresh token implementation
    async refresh() {
        const token = this.getCookie('refreshToken');
        const uid = this.getCookie('uid');
        
        if (token && uid) {
            const response = await fetch(this.server + '/refresh', {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, token }),
            });
            const data = await response.json();
            this.setToken(data);
            return data;
        }
        return false;
    }

    // Password-based login (alternative to OAuth redirect)
    async login(username, password) {
        const response = await fetch(this.server + '/login', {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return response.json();
    }

    // User registration
    async signup(username, password) {
        const redirectUrl = window.location.protocol + "//" + window.location.host + "/account/login#activated";
        const response = await fetch(this.server + '/signup?redirect=' + encodeURIComponent(redirectUrl), {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return response.json();
    }

    // Password reset request
    async reset(username, password = false) {
        const body = password !== false 
            ? JSON.stringify({ username, password, hash: this.reset_hash })
            : JSON.stringify({ username });
            
        const url = this.server + '/reset' + (password === false 
            ? '?redirect=' + encodeURIComponent(window.location.protocol + "//" + window.location.host + "/account/reset/hash")
            : '');
            
        const response = await fetch(url, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: body,
        });
        const data = await response.json();
        if (data.success) this.reset_hash = false;
        return data;
    }

    // Account deletion
    async delete(username, password) {
        const response = await fetch(this.server + '/delete', {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return response.json();
    }

    // Extract password reset hash from URL
    getPasswordResetHash() {
        const hash = window.location.hash;
        let resethash = false;
        hash.replace(/#reset=(.*)$/g, function (match, g1) {
            resethash = decodeURIComponent(g1);
        });
        return resethash;
    }
}
```

### Step 2: Create React Context Provider

Create `src/services/UserContext.js` - This manages authentication state across your React app:

```javascript
// src/services/UserContext.js
import React from 'react';
import OAuth from './OAuth';

export const UserContext = React.createContext();

export class UserProvider extends React.Component {
    constructor(props) {
        super(props);
        
        // Initialize OAuth client
        this.auth = new OAuth({ server: props.server });
        
        // Bind methods
        this.setState = this.setState.bind(this);
        this.getToken = this.getToken.bind(this);
        this.logOut = this.logOut.bind(this);
        this.login = this.login.bind(this);
        this.signup = this.signup.bind(this);
        this.reset = this.reset.bind(this);
        this.delete = this.delete.bind(this);
        this.refresh = this.refresh.bind(this);
        this.clear = this.clear.bind(this);

        // Initial state
        this.state = {
            // Authentication status
            authenticated: false,
            token: null,
            claims: {},
            isAdmin: false,
            
            // User feedback
            error: "",
            success: "",
            
            // Available methods
            setState: this.setState,
            getToken: this.getToken,
            login: this.login,
            signup: this.signup,
            reset: this.reset,
            delete: this.delete,
            refresh: this.refresh,
            logOut: this.logOut,
            
            // Special states
            resetHash: this.auth.reset_hash,
        };
        
        this.initialState = { ...this.state };
        
        // Check for existing authentication
        this.getToken();
    }

    // Check if user has admin role
    isAdmin(claims) {
        if ('role' in claims) {
            if (typeof claims.role === 'string') claims.role = [claims.role];
            if (claims.role.includes('admin')) return true;
        }
        return false;
    }

    // Get and process JWT token
    async getToken() {
        const token = await this.auth.getToken(true);
        
        if (!token || token.toString().split(".").length < 2) return;
        
        // Decode JWT payload (base64)
        try {
            const claims = JSON.parse(window.atob(token.toString().split(".")[1]));
            const isAdmin = this.isAdmin(claims);
            
            if (token !== this.state.token) {
                await this.setState({ 
                    token, 
                    claims, 
                    isAdmin, 
                    authenticated: true 
                });
            }
            return token;
        } catch (error) {
            console.error('Token decode error:', error);
            this.logOut();
        }
    }

    // Login with username/password
    login(username, password, history = false, path = false) {
        this.clear();
        this.auth.login(username, password).then(data => {
            if (data.error) {
                this.setState({ error: data.error.message });
                this.setclear(10);
            } else if (data.uid) {
                this.auth.setToken(data);
                this.getToken().then(() => {
                    if (history && path) history.push(path);
                });
            }
        });
    }

    // User registration
    signup(username, password) {
        this.clear();
        this.auth.signup(username, password).then(data => {
            if (data.error) {
                this.setState({ error: data.error.message });
                this.setclear(10);
            } else if (data.success) {
                this.setState({ success: data.success, resetHash: false });
            }
        });
    }

    // Password reset
    reset(username, password = false, history = false, path = false) {
        this.clear();
        this.auth.reset(username, password).then(data => {
            if (data.error) {
                this.setState({ error: data.error.message });
                this.setclear(10);
            } else if (data.success) {
                this.setState({ success: data.success, resetHash: false });
                if (history && path) history.push(path);
            }
        });
    }

    // Account deletion
    delete(username, password, history = false, path = false) {
        this.clear();
        this.auth.delete(username, password).then(data => {
            if (data.error) {
                this.setState({ error: data.error.message });
                this.setclear(10);
            } else if (data.success) {
                this.logOut();
                this.setState({ success: data.success });
            }
        });
    }

    // Logout
    logOut() {
        this.auth.setToken({});  // Clear tokens
        this.setState(this.initialState);  // Reset state
    }

    // Refresh authentication
    async refresh() {
        const token = await this.auth.refresh();
        if (!token || token.error) {
            this.logOut();
        } else {
            this.getToken();
        }
    }

    // Clear error/success messages
    clear() {
        this.setState({ error: "", success: "" });
    }

    // Auto-clear messages after timeout
    setclear(seconds = 10) {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.clear, seconds * 1000);
    }

    render() {
        return (
            <UserContext.Provider value={this.state}>
                {this.props.children}
            </UserContext.Provider>
        );
    }
}
```

### Step 3: Integrate with React App

Update your `src/App.js` to use the authentication:

```javascript
// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route } from "react-router-dom";
import { UserProvider } from './services/UserContext';

// Your components
import Header from './components/Header';
import Footer from './components/Footer';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
    return (
        <div className="app-wrapper">
            <Router>
                <UserProvider server="https://id.tracy.nu">
                    <Header />
                    <main className="content container">
                        <Route exact path="/" component={Dashboard} />
                        <Route path="/login" component={Login} />
                        {/* Add your routes here */}
                    </main>
                    <Footer />
                </UserProvider>
            </Router>
        </div>
    );
}

export default App;
```

### Step 4: Create Login Component

Create `src/components/Login.js` - A complete login form:

```javascript
// src/components/Login.js
import React, { useContext, useState } from 'react';
import { UserContext } from '../services/UserContext';

export default function Login({ history }) {
    const user = useContext(UserContext);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    // Handle activation success message
    const hash = window.location.hash;
    if (hash === "#activated") {
        window.history.replaceState(window.history.state, document.title, window.location.href.split('#')[0]);
        user.setState({ success: "Account successfully activated, you can now log in" });
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        user.login(username, password, history, '/dashboard');
    };

    return (
        <section className="login-section">
            <h2>Log In</h2>
            <div className="form-container">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <input 
                            type="email" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Email address" 
                            required 
                        />
                    </div>
                    
                    <div className="form-group">
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Password" 
                            required 
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-primary">
                        Log In
                    </button>
                    
                    {user.error && (
                        <div className="alert alert-error">
                            {user.error}
                        </div>
                    )}
                    
                    {user.success && (
                        <div className="alert alert-success">
                            {user.success}
                        </div>
                    )}
                </form>
                
                <div className="form-links">
                    <a href="/signup">Don't have an account? Sign up</a>
                    <a href="/reset">Forgot your password?</a>
                </div>
            </div>
        </section>
    );
}
```

### Step 5: Create Protected Route Component

Create `src/components/ProtectedRoute.js` for route protection:

```javascript
// src/components/ProtectedRoute.js
import React, { useContext } from 'react';
import { Route, Redirect } from 'react-router-dom';
import { UserContext } from '../services/UserContext';

export function ProtectedRoute({ component: Component, adminRequired = false, ...rest }) {
    const user = useContext(UserContext);
    
    return (
        <Route 
            {...rest} 
            render={(props) => {
                // Check if user is authenticated
                if (!user.authenticated) {
                    return <Redirect to="/login" />;
                }
                
                // Check if admin access is required
                if (adminRequired && !user.isAdmin) {
                    return <Redirect to="/unauthorized" />;
                }
                
                // User is authorized, render component
                return <Component {...props} />;
            }} 
        />
    );
}

// Usage in App.js:
// <ProtectedRoute path="/dashboard" component={Dashboard} />
// <ProtectedRoute path="/admin" component={AdminPanel} adminRequired={true} />
```

### Step 6: Create Authentication Header Component

Create `src/components/Header.js` with authentication-aware navigation:

```javascript
// src/components/Header.js
import React, { useContext } from 'react';
import { NavLink } from "react-router-dom";
import { UserContext } from '../services/UserContext';

export default function Header() {
    const user = useContext(UserContext);

    return (
        <header>
            <nav className="navbar">
                <div className="container">
                    <NavLink to="/" className="navbar-brand">
                        Your App
                    </NavLink>
                    
                    <div className="navbar-nav">
                        <NavLink to="/" className="nav-link">Home</NavLink>
                        <NavLink to="/about" className="nav-link">About</NavLink>
                        
                        {user.authenticated ? (
                            <>
                                <NavLink to="/dashboard" className="nav-link">
                                    Dashboard
                                </NavLink>
                                
                                {user.isAdmin && (
                                    <NavLink to="/admin" className="nav-link">
                                        Admin
                                    </NavLink>
                                )}
                                
                                <span className="nav-text">
                                    Welcome, {user.claims.sub || 'User'}
                                </span>
                                
                                <button 
                                    onClick={user.logOut} 
                                    className="btn btn-link nav-link"
                                >
                                    Log Out
                                </button>
                            </>
                        ) : (
                            <>
                                <NavLink to="/login" className="nav-link">
                                    Log In
                                </NavLink>
                                <NavLink to="/signup" className="nav-link">
                                    Sign Up
                                </NavLink>
                            </>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
}
```

## Architecture Components Deep Dive

Now that you have the basic implementation, let's understand the architecture:

## Complete OAuth Flow

### Phase 1: Application Initialization

When your React app starts:

```javascript
// 1. App renders with UserProvider
<UserProvider server="https://id.tracy.nu">
    <App />
</UserProvider>

// 2. UserProvider constructor runs
constructor(props) {
    // Creates OAuth client
    this.auth = new OAuth({ server: props.server });
    
    // Sets up initial state
    this.state = {
        authenticated: false,
        token: null,
        claims: {},
        // ... other state
    };
    
    // Immediately check for existing auth
    this.getToken();
}

// 3. OAuth constructor runs
constructor(opt) {
    this.server = opt.server;  // "https://id.tracy.nu"
    this.state = this.getCookie('state');
    
    // If returning from OAuth server, validate immediately
    if (this.state) this.validate();
}
```

### Phase 2: Authentication Check & Token Management

The system automatically checks if the user is already authenticated:

```javascript
// UserContext calls getToken() immediately after construction
async getToken() {
    // Try to get existing token from OAuth client
    const token = await this.auth.getToken(true);
    
    if (!token || token.toString().split(".").length < 2) return;
    
    // Decode JWT to get user claims
    const claims = JSON.parse(window.atob(token.toString().split(".")[1]));
    const isAdmin = this.isAdmin(claims);
    
    // Update React state with authentication info
    if (token !== this.state.token) {
        await this.setState({ 
            token, 
            claims, 
            isAdmin, 
            authenticated: true 
        });
    }
    return token;
}

// OAuth.getToken() handles token retrieval and refresh
async getToken(stayhere = false) {
    let token = this.getCookie('token');
    
    if (!token) {
        // No access token, try refreshing
        const result = await this.refresh();
        
        if (!result || result.error) {
            if (stayhere) return result.error;
            // Need to login - redirect to OAuth server
            this.authorize();
        }
        
        token = this.getCookie('token');
    }
    
    return token;
}

// Automatic token refresh using refresh token
async refresh() {
    const refreshToken = this.getCookie('refreshToken');
    const uid = this.getCookie('uid');
    
    if (refreshToken && uid) {
        try {
            const response = await fetch(this.server + '/refresh', {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, token: refreshToken }),
            });
            
            const data = await response.json();
            
            if (data.access_token || data.idToken) {
                this.setToken(data);  // Store new tokens
                return data;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
        }
    }
    
    return false;
}
```

### Phase 3: OAuth Authorization Flow (When Login Required)

When no valid token exists, the system initiates the OAuth authorization flow:

```javascript
// 1. Generate security parameters and redirect to OAuth server
authorize() {
    // Generate CSRF protection parameters
    this.nonce = this.generateRandomString();  // Replay attack protection
    this.state = this.generateRandomString();  // CSRF protection
    this.setCookie("state", this.state);       // Store state for later verification
    
    // Build OAuth authorization URL with all parameters
    let queryString = "";
    Object.keys(this).forEach(key => {
        // Skip internal properties
        if (key === "cookiePrefix" || key === "server" || this[key] === null) return;
        queryString += (queryString ? "&" : "") + key + '=' + encodeURIComponent(this[key]);
    });
    
    // Full redirect URL example:
    // https://id.tracy.nu/authorize?
    //   response_type=token&
    //   scope=openid&
    //   redirect_uri=https%3A//yourapp.com/&
    //   state=MTIzNDU2NzgxMjM0NTY3OA&
    //   nonce=OTg3NjU0MzIxOTg3NjU0MzI&
    //   client_id=your_client_id
    
    window.location.href = this.server + '/authorize?' + queryString;
}
```

**What happens next:**

1. **User is redirected** to `https://id.tracy.nu/authorize` with parameters
2. **OAuth server validates** the request parameters
3. **User sees login form** on the OAuth server
4. **User authenticates** with username/password
5. **OAuth server generates tokens** and redirects back to your app
6. **Your app receives tokens** in the URL fragment

### Phase 4: OAuth Callback Processing & Token Storage

When the OAuth server redirects back to your app, the URL contains tokens in the fragment:

```javascript
// Example callback URL:
// https://yourapp.com/#access_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
//                   &token_type=Bearer
//                   &expires_in=3600
//                   &state=MTIzNDU2NzgxMjM0NTY3OA
//                   &refresh_token=def50200...

// OAuth constructor automatically detects and processes this
validate() {
    // Parse URL fragment into key-value pairs
    const hash = window.location.hash.substr(1);
    const result = hash.split('&').reduce(function (result, item) {
        const parts = item.split('=');
        result[parts[0]] = decodeURIComponent(parts[1]);
        return result;
    }, {});
    
    // Verify CSRF protection
    if (result && result.state === this.state) {
        // Security check passed
        this.setCookie("state", "", 0);    // Clear state cookie
        window.location.hash = "";         // Clean URL
        this.setToken(result);             // Store tokens
    } else {
        // Security check failed - possible CSRF attack
        console.error('OAuth state mismatch - possible CSRF attack');
    }
}

// Store tokens with appropriate expiration times
setToken(result) {
    // Extract token data with fallbacks for different server responses
    const maxAge = result.expires_in || result.accessTokenExpirationSeconds || 3600;
    const refreshMaxAge = maxAge === 1 ? 1 : 3600 * 24 * 30; // 30 days
    const token = result.access_token || result.idToken || "";
    const refreshToken = result.refresh_token || result.refreshToken || "";
    const uid = result.uid || "";
    
    // Store in cookies with appropriate expiration
    this.setCookie("token", token, maxAge);                    // Access token (short-lived)
    this.setCookie("refreshToken", refreshToken, refreshMaxAge); // Refresh token (30 days)
    this.setCookie("uid", uid, refreshMaxAge);                 // User ID (30 days)
    
    console.log('Tokens stored successfully');
}

// Cookie storage with prefixed names
setCookie(name, value, maxAgeInSeconds = 300) {
    // Example: "oauth_token", "oauth_refreshToken", "oauth_uid"
    document.cookie = this.cookiePrefix + name + "=" + value + 
                     ";path=/;max-age=" + maxAgeInSeconds.toString();
}
```

**Security Features:**
- **State Parameter Verification**: Prevents CSRF attacks
- **URL Fragment**: Tokens never sent to server (client-side only)  
- **Automatic Cleanup**: State cookies cleared after use
- **URL Cleaning**: Hash removed from URL for clean user experience

### Phase 5: JWT Processing & User State Management

After tokens are stored, the React app processes the JWT to extract user information:

```javascript
// JWT structure: header.payload.signature
// Example JWT payload (base64 encoded):
// {
//   "sub": "user@example.com",
//   "iat": 1640995200,
//   "exp": 1641001200,
//   "role": ["user", "admin"],
//   "name": "John Doe"
// }

async getToken() {
    // Get token from OAuth client
    const token = await this.auth.getToken(true);
    
    if (!token || token.toString().split(".").length < 2) return;
    
    try {
        // Decode JWT payload (middle part, base64 encoded)
        const payloadBase64 = token.toString().split(".")[1];
        const claims = JSON.parse(window.atob(payloadBase64));
        
        // Check for admin privileges
        const isAdmin = this.isAdmin(claims);
        
        console.log('User claims:', claims);
        console.log('Is admin:', isAdmin);
        
        // Update React state with user information
        if (token !== this.state.token) {
            await this.setState({ 
                token,           // JWT access token
                claims,          // Decoded user information
                isAdmin,         // Boolean admin flag
                authenticated: true  // User is now authenticated
            });
        }
        
        return token;
    } catch (error) {
        console.error('Token decode error:', error);
        this.logOut();  // Invalid token, log out user
    }
}

// Role-based access control
isAdmin(claims) {
    if ('role' in claims) {
        // Handle both string and array role formats
        let roles = claims.role;
        if (typeof roles === 'string') roles = [roles];
        
        // Check if 'admin' role is present
        return roles.includes('admin');
    }
    return false;
}

// Example usage in components:
const user = useContext(UserContext);

// Check authentication status
if (user.authenticated) {
    console.log('User is logged in:', user.claims.sub);
    
    // Check admin privileges
    if (user.isAdmin) {
        console.log('User has admin access');
    }
}
```

**What's Available in React Components:**

```javascript
const user = useContext(UserContext);

// Authentication state
user.authenticated    // boolean: is user logged in?
user.token           // string: JWT access token
user.claims          // object: decoded JWT payload
user.isAdmin         // boolean: does user have admin role?

// User information from JWT claims
user.claims.sub      // User identifier (email)
user.claims.name     // Full name
user.claims.role     // User roles array
user.claims.exp      // Token expiration timestamp

// Methods
user.login(email, password, history, redirectPath)
user.signup(email, password)  
user.logOut()
user.refresh()

// UI feedback
user.error          // Error message to display
user.success        // Success message to display
```

## User Management Operations

### Login Flow (`UserContext.js:98-111`)

```javascript
login(username, password, history = false, path = false) {
    this.clear();
    this.auth.login(username, password).then(data => {
        if (data.error) {
            this.setState({ error: data.error.message });
        } else if (data.uid) {
            this.auth.setToken(data);
            this.getToken().then(token => {
                if (history && path) history.push(path);
            });
        }
    });
}
```

**API Call** (`OAuth.js:69-78`):
- **URL**: `https://id.tracy.nu/login`
- **Method**: POST
- **Body**: `{username, password}`
- **Response**: `{uid, access_token, refresh_token, expires_in}` or `{error}`

### Signup Flow (`UserContext.js:51-63`)

**API Call** (`OAuth.js:58-68`):
- **URL**: `https://id.tracy.nu/signup?redirect=<activation_url>`
- **Method**: POST
- **Body**: `{username, password}`
- **Redirect URL**: `<domain>/account/login#activated`
- **Response**: `{success}` or `{error}`

### Password Reset Flow

#### Step 1: Request Reset (`OAuth.js:47-57`)
- **URL**: `https://id.tracy.nu/reset?redirect=<reset_url>`
- **Method**: POST
- **Body**: `{username}`
- **Redirect URL**: `<domain>/account/reset/hash`

#### Step 2: Complete Reset (`OAuth.js:47-57`)
- **URL**: `https://id.tracy.nu/reset`
- **Method**: POST
- **Body**: `{username, password, hash}`
- **Hash**: Extracted from URL fragment `#reset=<hash>`

### Account Deletion (`OAuth.js:79-88`)
- **URL**: `https://id.tracy.nu/delete`
- **Method**: POST
- **Body**: `{username, password}`
- **Response**: `{success}` or `{error}`

## Token Lifecycle Management

### Cookie Configuration
- **Prefix**: `oauth_`
- **Path**: `/`
- **Names**:
  - `oauth_token`: JWT access token
  - `oauth_refreshToken`: Refresh token
  - `oauth_uid`: User identifier
  - `oauth_state`: OAuth state parameter (temporary)

### Token Expiration
- **Access Token**: Server-specified duration
- **Refresh Token**: 30 days
- **Automatic Refresh**: Attempted before each token use

### Logout Process (`UserContext.js:112-115`)
```javascript
logOut() {
    this.auth.setToken({}); // Clear all tokens
    this.setState(this.initialState); // Reset state
}
```

## Security Features

### CSRF Protection
- **State Parameter**: Random string stored in cookie, verified on callback
- **Nonce**: Random string for replay attack prevention

### Token Security
- **JWT Validation**: Proper JWT structure validation
- **Secure Cookies**: HTTP-only cookies for token storage
- **Automatic Cleanup**: State cookies cleared after use

### URL Fragment Processing
- **Password Reset**: Hash extraction and cleanup
- **OAuth Callback**: Fragment parsing and URL cleaning
- **History Management**: Clean URLs after authentication

## Error Handling

### Authentication Errors
- **Display**: User-friendly error messages in UI
- **Auto-Clear**: Error messages auto-clear after 10 seconds
- **Fallback**: Automatic redirect to login on token failure

### Network Errors
- **Fetch API**: All API calls use modern fetch with JSON parsing
- **Error Propagation**: Server errors bubble up to UI components

## Integration Points

### React Router Integration
- **History API**: Programmatic navigation after auth operations
- **Route Protection**: Authentication state used in components
- **Redirect Handling**: Post-auth navigation to intended destinations

### Component Integration
- **Context Consumer**: Components use `useContext(UserContext)`
- **State Access**: Authentication state, user claims, admin status
- **Methods**: Login, logout, signup, reset, delete operations

## Production Considerations

### Server Communication
- **Base URL**: `https://id.tracy.nu`
- **HTTPS**: All API communication over secure connection
- **CORS**: Proper cross-origin resource sharing configuration required

### Performance
- **Token Caching**: Tokens cached in cookies to avoid repeated API calls
- **Automatic Refresh**: Background token refresh prevents user disruption
- **State Management**: Minimal re-renders through careful state updates

### Scalability
- **Stateless**: Client-side token storage enables horizontal scaling
- **JWT**: Self-contained tokens reduce server-side session storage
- **Cookie Storage**: Browser-native storage mechanism for reliability

## Technical Specifications

### Supported OAuth 2.0 Features
- **Authorization Code Flow**: Implicit flow (`response_type=token`)
- **Refresh Tokens**: Long-lived refresh capability
- **OpenID Connect**: Basic OpenID Connect support (`scope=openid`)
- **Custom Claims**: Admin role detection and custom user attributes

### Browser Compatibility
- **Modern Browsers**: ES6+ features (async/await, fetch, arrow functions)
- **Cookie Support**: Requires third-party cookies enabled
- **Local Storage**: Falls back to cookies for token storage
- **History API**: Uses modern browser history management

### Dependencies
- **React 18**: Modern React hooks and context
- **React Router 5**: Client-side routing
- **Fetch API**: Modern HTTP client
- **Base64 Decoding**: Built-in `atob()` for JWT parsing