import React from 'react';
import './App.css';
import Header from './Header';
import Footer from './Footer';
import Dashboard from './Dashboard';
import AccountLogin from './account/Login';
import AccountSignup from './account/Signup';
import AccountResetStep1 from './account/ResetStep1';
import AccountResetStep2 from './account/ResetStep2';

import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import { UserProvider } from './services/UserContext'

function LoginPage() {
	return (
		<>
			<Header />
			<div className="content container">
				<Route exact path="/account/login" component={AccountLogin} />
			</div>
			<Footer />
		</>
	);
}

function SignupPage() {
	return (
		<>
			<Header />
			<div className="content container">
				<Route exact path="/account/signup" component={AccountSignup} />
			</div>
			<Footer />
		</>
	);
}

function ResetStep1Page() {
	return (
		<>
			<Header />
			<div className="content container">
				<Route exact path="/account/reset" component={AccountResetStep1} />
			</div>
			<Footer />
		</>
	);
}

function ResetStep2Page() {
	return (
		<>
			<Header />
			<div className="content container">
				<Route exact path="/account/reset/hash" component={AccountResetStep2} />
			</div>
			<Footer />
		</>
	);
}

function App() {
	return (
		<div className="wrapper">
			<Router>
			<UserProvider server="https://id.tracy.nu">
				<Switch>
					<Route exact path="/" component={Dashboard} />
					<Route exact path="/account/login" component={LoginPage} />
					<Route exact path="/account/signup" component={SignupPage} />
					<Route exact path="/account/reset" component={ResetStep1Page} />
					<Route exact path="/account/reset/hash" component={ResetStep2Page} />
				</Switch>
				</UserProvider>
			</Router>
		</div>
	);
}

export default App;
