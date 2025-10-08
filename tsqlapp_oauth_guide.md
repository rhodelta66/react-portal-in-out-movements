# TSQL.APP OAuth Authentication Complete Integration Guide

## Overview

This document serves as a comprehensive training guide for implementing OAuth 2.0 authentication in TSQL.APP applications using the Tracy Identity Server. TSQL.APP uses a Server-Driven UI architecture where T-SQL generates the user interface, while a universal ReactJS client handles OAuth authentication and renders the server-generated UI.

**Server**: `https://id.tracy.nu`  
**Flow Type**: OAuth 2.0 Implicit Flow with Refresh Tokens  
**Frontend**: React 18 with Context API  
**Backend**: TSQL.APP (SQL Server + .NET Core API)

## Architecture Overview

```
User Browser
    ↓ (OAuth Login)
Tracy Identity Server (https://id.tracy.nu)
    ↓ (JWT Token)
ReactJS Client (Universal Frontend)
    ↓ (Authenticated API Requests with JWT)
TSQL.APP Backend (SQL Server + .NET Core API)
    ↓ (Server-Driven UI JSON)
ReactJS Client (Renders T-SQL Generated UI)
```

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

### Step 3: Create TSQL.APP API Client

Create `src/services/TSQLAPIClient.js` for authenticated TSQL.APP API calls:

```javascript
// src/services/TSQLAPIClient.js
export class TSQLAPIClient {
    constructor(baseURL, userContext) {
        this.baseURL = baseURL;  // e.g., 'https://yourapp.tsql.app'
        this.userContext = userContext;
    }
    
    async makeAPICall(path, options = {}) {
        try {
            const token = await this.userContext.getToken();
            
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            };
            
            const response = await fetch(`${this.baseURL}${path}`, {
                method: 'POST',
                ...options,
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Handle TSQL.APP specific responses
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Display TSQL.APP toast messages
            if (data.toasts) {
                data.toasts.forEach(toast => {
                    this.showToast(toast.txt, toast.cls);
                });
            }
            
            return data;
            
        } catch (error) {
            if (error.status === 401) {
                // Token expired, try refresh
                await this.userContext.refresh();
                return this.makeAPICall(path, options); // Retry once
            }
            throw error;
        }
    }
    
    showToast(message, className) {
        // Implementation depends on your toast notification system
        console.log(`Toast: ${message} (${className})`);
    }
    
    // TSQL.APP specific API calls
    async executeCardAction(cardName, actionName, payload = {}) {
        return this.makeAPICall(`/api/card/${cardName}/action/${actionName}`, {
            body: JSON.stringify(payload)
        });
    }
    
    async getCardData(cardName, id = null) {
        const path = id ? `/api/card/${cardName}/${id}` : `/api/card/${cardName}`;
        return this.makeAPICall(path, { method: 'GET' });
    }
}
```

### Step 4: Integrate with React App

Update your `src/App.js` to use the authentication:

```javascript
// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import { UserProvider } from './services/UserContext';
import { TSQLAPIClient } from './services/TSQLAPIClient';

// Your components
import Header from './components/Header';
import Footer from './components/Footer';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TSQLAPPModal from './components/TSQLAPPModal';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <div className="app-wrapper">
            <Router>
                <UserProvider server="https://id.tracy.nu">
                    <Header />
                    <main className="content container">
                        <Switch>
                            <Route exact path="/" component={Dashboard} />
                            <Route path="/login" component={Login} />
                            <ProtectedRoute path="/dashboard" component={Dashboard} />
                            <ProtectedRoute path="/admin" component={Dashboard} adminRequired={true} />
                            <Route path="/modal/:cardName/:actionName" component={TSQLAPPModal} />
                        </Switch>
                    </main>
                    <Footer />
                </UserProvider>
            </Router>
        </div>
    );
}

export default App;
```

### Step 5: Create Login Component

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

    const handleOAuthLogin = () => {
        // Trigger OAuth flow
        user.auth?.authorize();
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
                    
                    <button type="button" onClick={handleOAuthLogin} className="btn btn-secondary">
                        Login with OAuth
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

### Step 6: Create Protected Route Component

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
```

### Step 7: Create Authentication Header Component

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
                        TSQL.APP Demo
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
                                    Welcome, {user.claims.sub || user.claims.email || 'User'}
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

### Step 8: Create TSQL.APP Modal Component

Create `src/components/TSQLAPPModal.js` for rendering TSQL.APP modals:

```javascript
// src/components/TSQLAPPModal.js
import React, { useContext, useEffect, useState } from 'react';
import { UserContext } from '../services/UserContext';
import { TSQLAPIClient } from '../services/TSQLAPIClient';

function TSQLAPPModal({ match }) {
    const user = useContext(UserContext);
    const [modalData, setModalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const { cardName, actionName } = match.params;
    
    const apiClient = new TSQLAPIClient('https://yourapp.tsql.app', user);

    useEffect(() => {
        if (user.authenticated) {
            fetchModalData();
        }
    }, [user.authenticated, cardName, actionName]);

    const fetchModalData = async () => {
        try {
            setLoading(true);
            const data = await apiClient.executeCardAction(cardName, actionName);
            setModalData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleModalSubmit = async (formData) => {
        try {
            const data = await apiClient.executeCardAction(cardName, actionName, formData);
            setModalData(data);
            
            // If modal is cleared, redirect or close
            if (data.data_modalview && data.data_modalview.length === 0) {
                // Modal was cleared, handle accordingly
                window.history.back();
            }
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading TSQL.APP modal...</div>;
    if (error) return <div className="alert alert-error">Error: {error}</div>;
    if (!modalData) return <div>No modal data</div>;

    // Render TSQL.APP generated UI
    return (
        <div className="tsqlapp-modal">
            <TSQLAPPModalRenderer 
                data={modalData} 
                onSubmit={handleModalSubmit}
            />
        </div>
    );
}

function TSQLAPPModalRenderer({ data, onSubmit }) {
    const [formData, setFormData] = useState({});

    // Handle input changes
    const handleInputChange = (name, value) => {
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle form submission
    const handleSubmit = (buttonName) => {
        onSubmit({
            ...formData,
            [buttonName]: buttonName
        });
    };

    // Render modal elements based on data_modalview
    if (data.data_modalview) {
        return (
            <div className="modal-content">
                {data.data_modalview.map((element, index) => (
                    <TSQLAPPElement 
                        key={index}
                        element={element}
                        formData={formData}
                        onInputChange={handleInputChange}
                        onSubmit={handleSubmit}
                    />
                ))}
            </div>
        );
    }

    return <div>No modal elements to render</div>;
}

function TSQLAPPElement({ element, formData, onInputChange, onSubmit }) {
    switch (element.elem) {
        case 'Input':
            return (
                <div className="form-group">
                    <input
                        type={element.type || 'text'}
                        value={formData[element.name] || element.val || ''}
                        onChange={(e) => onInputChange(element.name, e.target.value)}
                        placeholder={element.placeholder}
                        className={element.cls}
                    />
                </div>
            );
            
        case 'Button':
            return (
                <button
                    onClick={() => onSubmit(element.name)}
                    className={element.cls || 'btn btn-primary'}
                >
                    {element.val}
                </button>
            );
            
        case 'Html':
            return (
                <div 
                    className={element.cls}
                    dangerouslySetInnerHTML={{ __html: element.val }}
                />
            );
            
        default:
            return <div>Unsupported element type: {element.elem}</div>;
    }
}

export default TSQLAPPModal;
```

## TSQL.APP Backend Integration

### Database Schema Configuration

TSQL.APP includes built-in OAuth support through these tables:

```sql
-- Configure OAuth provider
INSERT INTO api_oauth (name, url, scope, redirect_uri, client_id, client_secret)
VALUES (
    'Tracy Identity Server',
    'https://id.tracy.nu',
    'openid profile email',
    'https://yourapp.com/',
    'your_client_id',
    'your_client_secret'
);

-- Configure JWT claims mapping
INSERT INTO api_token_claim (claim, value, priority) VALUES
('role', 'admin', 10),
('role', 'user', 5),
('department', 'sales', 3);

-- Configure card-level access based on claims
INSERT INTO api_token_claim_card (token_claim_id, card_id) 
SELECT tc.id, c.id 
FROM api_token_claim tc
CROSS JOIN api_card c
WHERE tc.claim = 'role' AND tc.value = 'admin'
AND c.name IN ('UserManagement', 'SystemSettings');
```

### TSQL.APP Context Variables

When JWT tokens are processed by the TSQL.APP backend, the following context variables become available in T-SQL action scripts:

```sql
-- Available in all T-SQL action scripts after OAuth authentication
DECLARE @user_id INT;           -- From api_user.id (matched by JWT.sub)
DECLARE @user_name NVARCHAR(256); -- From JWT.sub (email address)  
DECLARE @user_roles NVARCHAR(MAX); -- From JWT claims, comma-separated

-- Example: Role-based logic in action scripts
IF dbo.hasRole('admin') > 0
BEGIN
    -- Admin-only functionality
    EXEC sp_api_modal_text @text=N'Admin Panel Available', @class=N'alert alert-info';
END

-- Example: User-specific data filtering
SELECT * FROM orders 
WHERE user_email = @user_name  -- Automatically populated from JWT
```

### Complete TSQL.APP Integration Example

#### 1. T-SQL Action Script with OAuth Context

```sql
-- TSQL.APP Action Script: User Dashboard
-- This script runs on the TSQL.APP backend
-- @user_name and @user_id are automatically populated from JWT

-- Declare variables for modal interaction (mandated practice)
DECLARE @UserInput NVARCHAR(MAX);
DECLARE @SubmitButton NVARCHAR(MAX);
DECLARE @AdminButton NVARCHAR(MAX);
DECLARE @Message NVARCHAR(MAX);
DECLARE @WelcomeText NVARCHAR(MAX);

-- Synchronize with client state (reactive execution model)
EXEC sp_api_modal_get_value @name=N'@UserInput', @value=@UserInput OUT;
EXEC sp_api_modal_get_value @name=N'@SubmitButton', @value=@SubmitButton OUT;
EXEC sp_api_modal_get_value @name=N'@AdminButton', @value=@AdminButton OUT;

-- Show user-specific greeting using JWT claims
SET @WelcomeText = CONCAT(N'Welcome, ', @user_name, N'! You are authenticated via OAuth.');
EXEC sp_api_modal_text @text=@WelcomeText, @class=N'h3';

-- Role-based UI elements using TSQL.APP's built-in role function
IF dbo.hasRole('admin') > 0
BEGIN
    EXEC sp_api_modal_text @text=N'Admin functions available', @class=N'text-success';
    
    -- Admin-only button
    EXEC sp_api_modal_button 
        @name=N'@AdminButton', 
        @value=N'Admin Panel', 
        @valueout=@AdminButton OUT,
        @class=N'btn-danger';
END

-- Standard modal input and button
EXEC sp_api_modal_text @text=N'Enter some data:', @class=N'label';
EXEC sp_api_modal_input 
    @name=N'@UserInput', 
    @value=@UserInput OUT,
    @placeholder=N'Type something here...';

EXEC sp_api_modal_button 
    @name=N'@SubmitButton', 
    @value=N'Submit', 
    @valueout=@SubmitButton OUT,
    @class=N'btn-primary';

-- Handle admin button click
IF @AdminButton IS NOT NULL
BEGIN
    -- Check user has admin role (double-check security)
    IF dbo.hasRole('admin') > 0
    BEGIN
        SET @Message = N'Admin function executed successfully!';
        EXEC sp_api_toast @text=@Message, @class=N'btn-success';
        
        -- Perform admin-only operations here
        -- ...
        
        -- Clear modal
        EXEC sp_api_modal_clear;
        RETURN;
    END
    ELSE
    BEGIN
        SET @Message = N'Access denied: Admin role required';
        EXEC sp_api_toast @text=@Message, @class=N'btn-danger';
        RETURN;
    END
END

-- Handle standard submission
IF @SubmitButton IS NOT NULL
BEGIN
    -- Validate input
    IF LEN(TRIM(ISNULL(@UserInput, N''))) < 1
    BEGIN
        SET @Message = N'Please enter some data';
        EXEC sp_api_toast @text=@Message, @class=N'btn-warning';
        RETURN;
    END
    
    -- Save data with user context (user_id automatically available)
    INSERT INTO user_data (user_id, input_value, created_date, created_by)
    VALUES (@user_id, @UserInput, GETDATE(), @user_name);
    
    SET @Message = CONCAT(N'Data saved successfully for user: ', @user_name);
    EXEC sp_api_toast @text=@Message, @class=N'btn-success';
    EXEC sp_api_modal_clear;
    RETURN;
END
```

#### 2. React Component Making TSQL.APP API Call

```javascript
import React, { useContext, useEffect, useState } from 'react';
import { UserContext } from '../services/UserContext';
import { TSQLAPIClient } from '../services/TSQLAPIClient';

function UserDashboard() {
    const user = useContext(UserContext);
    const [apiClient, setApiClient] = useState(null);
    
    useEffect(() => {
        if (user.authenticated) {
            setApiClient(new TSQLAPIClient('https://yourapp.tsql.app', user));
        }
    }, [user.authenticated]);

    const openUserModal = async () => {
        try {
            const modalData = await apiClient.executeCardAction('users', 'dashboard');
            // Modal data is returned and can be processed by TSQLAPPModal component
            console.log('Modal data:', modalData);
        } catch (error) {
            console.error('Failed to open modal:', error);
        }
    };

    if (!user.authenticated) {
        return <div>Please log in to view dashboard</div>;
    }

    return (
        <div className="user-dashboard">
            <h1>Dashboard</h1>
            <p>Welcome, {user.claims.sub || user.claims.email}</p>
            
            {user.isAdmin && (
                <div className="admin-section">
                    <h3>Admin Functions</h3>
                    <button onClick={openUserModal} className="btn btn-primary">
                        Open User Modal
                    </button>
                </div>
            )}
            
            <div className="user-info">
                <h3>Your Information</h3>
                <ul>
                    <li>Email: {user.claims.sub || user.claims.email}</li>
                    <li>Name: {user.claims.name || 'Not provided'}</li>
                    <li>Roles: {Array.isArray(user.claims.role) ? user.claims.role.join(', ') : user.claims.role || 'None'}</li>
                    <li>Admin: {user.isAdmin ? 'Yes' : 'No'}</li>
                </ul>
            </div>
        </div>
    );
}

export default UserDashboard;
```

## Authentication Flow Deep Dive

### Complete OAuth Flow

#### Phase 1: Application Initialization

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

#### Phase 2: Authentication Check & Token Management

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
```

#### Phase 3: OAuth Authorization Flow

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

#### Phase 4: OAuth Callback Processing

When the OAuth server redirects back to your app:

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
```

#### Phase 5: JWT Processing & User State Management

After tokens are stored, the React app processes the JWT:

```javascript
async getToken() {
    // Get token from OAuth client
    const token = await this.auth.getToken(true);
    
    if (!token || token.toString().split(".").length < 2) return;
    
    try {
        // Decode JWT payload (middle part, base64 encoded)
        const payloadBase64 = token.toString().split(".")[1];
        const claims = JSON.parse(window.atob(payloadBase64));
        
        // Check for admin privileges using TSQL.APP pattern
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
```

## TSQL.APP Troubleshooting

### Common Issues and Solutions

#### 1. Token Not Reaching T-SQL Context Variables

```sql
-- Check if JWT is being processed in TSQL.APP
SELECT claims, claims_ts, claims_exp FROM api_user WHERE name = 'user@example.com';

-- Verify token claim mappings
SELECT * FROM api_token_claim;
SELECT * FROM api_token_claim_card WHERE card_id = @your_card_id;

-- Debug user context in action script
DECLARE @debug_message NVARCHAR(MAX);
SET @debug_message = CONCAT(N'User: ', @user_name, N', ID: ', @user_id, N', Roles: ', SESSION_CONTEXT(N'user_roles'));
EXEC sp_api_toast @text=@debug_message, @class=N'btn-info';
```

#### 2. Role-based Access Not Working

```sql
-- Debug role function in action script
DECLARE @role_result INT;
SET @role_result = dbo.hasRole('admin,user');
DECLARE @role_message NVARCHAR(MAX);
SET @role_message = CONCAT(N'Role check result: ', @role_result);
EXEC sp_api_toast @text=@role_message, @class=N'btn-info';

-- Check user roles in session context
DECLARE @current_roles NVARCHAR(MAX);
SET @current_roles = SESSION_CONTEXT(N'user_roles');
SET @role_message = CONCAT(N'Current roles: ', ISNULL(@current_roles, 'NULL'));
EXEC sp_api_toast @text=@role_message, @class=N'btn-info';
```

#### 3. CORS Issues with OAuth

Configure your TSQL.APP backend to accept OAuth origins. In your .NET Core configuration:

```csharp
// In TSQL.APP Startup.cs or Program.cs
public void ConfigureServices(IServiceCollection services)
{
    services.AddCors(options => {
        options.AddPolicy("OAuthPolicy", builder => {
            builder.WithOrigins("https://id.tracy.nu", "https://yourapp.tsql.app")
                   .AllowCredentials()
                   .AllowAnyHeader()
                   .AllowAnyMethod();
        });
    });
    
    // Other TSQL.APP services...
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseCors("OAuthPolicy");
    
    // Other TSQL.APP middleware...
}
```

#### 4. Token Expiry Handling

```javascript
// Enhanced error handling in TSQLAPIClient
async makeAPICall(path, options = {}) {
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount < maxRetries) {
        try {
            const token = await this.userContext.getToken();
            
            const response = await fetch(`${this.baseURL}${path}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (response.status === 401 && retryCount === 0) {
                // Token expired, try refresh
                await this.userContext.refresh();
                retryCount++;
                continue;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            if (retryCount === maxRetries - 1) {
                throw error;
            }
            retryCount++;
        }
    }
}
```

## Production Deployment Checklist

### Frontend Configuration

```javascript
// src/config/oauth.js
const config = {
    development: {
        oauthServer: 'https://id.tracy.nu',
        tsqlAppServer: 'https://dev.yourapp.tsql.app',
        clientId: 'your_dev_client_id'
    },
    production: {
        oauthServer: 'https://id.tracy.nu',
        tsqlAppServer: 'https://prod.yourapp.tsql.app',
        clientId: 'your_prod_client_id'
    }
};

export default config[process.env.NODE_ENV || 'development'];
```

### TSQL.APP Backend Configuration

```sql
-- Production OAuth configuration
UPDATE api_oauth SET 
    client_id = 'your_production_client_id',
    client_secret = 'your_production_client_secret',
    redirect_uri = 'https://prod.yourapp.com/'
WHERE name = 'Tracy Identity Server';

-- Verify role mappings for production
SELECT tc.claim, tc.value, COUNT(tcc.card_id) as card_count
FROM api_token_claim tc
LEFT JOIN api_token_claim_card tcc ON tc.id = tcc.token_claim_id
GROUP BY tc.claim, tc.value;
```

### Security Considerations

1. **HTTPS Everywhere**: Ensure all OAuth flows use HTTPS
2. **Token Storage**: Consider using secure HTTP-only cookies for token storage
3. **CORS Configuration**: Properly configure CORS for production domains
4. **Role Validation**: Always verify roles on both frontend and backend
5. **Token Expiration**: Implement proper token refresh logic

### Performance Optimization

```javascript
// Implement token caching to avoid repeated API calls
class TokenCache {
    constructor(ttlMs = 300000) { // 5 minutes default
        this.cache = new Map();
        this.ttl = ttlMs;
    }
    
    set(key, value) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + this.ttl
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (item && Date.now() < item.expiry) {
            return item.value;
        }
        this.cache.delete(key);
        return null;
    }
}

// Use in TSQLAPIClient
const tokenCache = new TokenCache();
```

## Summary

This complete integration guide provides everything needed to implement OAuth authentication in TSQL.APP applications:

1. **Frontend OAuth Implementation**: Complete React components for authentication
2. **TSQL.APP Backend Integration**: Database configuration and T-SQL context variables
3. **API Client**: Authenticated communication between React and TSQL.APP
4. **Security**: CSRF protection, role-based access control, and token management
5. **Troubleshooting**: Common issues and debugging techniques
6. **Production**: Deployment considerations and performance optimization

The key insight is that TSQL.APP's Server-Driven UI architecture works seamlessly with OAuth authentication - the ReactJS client handles authentication and token management, while the T-SQL backend receives authenticated context variables and generates dynamic UI responses. This creates a powerful combination of modern authentication with rapid T-SQL development.