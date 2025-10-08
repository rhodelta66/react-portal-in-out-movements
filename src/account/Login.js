import React, { useContext, useState, useEffect } from 'react';
import Title from "../Title";
import { UserContext } from '../services/UserContext'
//import { NavLink } from "react-router-dom";
import { Input, Button, Errors } from '../Forms'

export default function Login({ history }) {
	const user = useContext(UserContext);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	var hash = window.location.hash;
	if(hash === "#activated"){
		window.history.replaceState(window.history.state, document.title, window.location.href.split('#')[0]);
		user.success = "Account succesvol geactiveerd, u kunt nu inloggen";
	}

	useEffect(() => {
		if (user.authenticated) {
			history.push('/');
		}
	}, [user.authenticated, history]);
	return (
		<section>
			<Title>Log in</Title>
			<div className="mx-auto col-lg-4 col-md-6 mb-4 text2-center">
				<form>

					<Input type="email" link={{ to: '/account/signup', text: 'Registreren?' }} onChange={e => setUsername(e.target.value)} name="username" placeholder="E-mailadres" icon="envelope" />
					<Input type="password" link={{ to: '/account/reset', text: 'Wachtwoord vergeten?' }} onChange={e => setPassword(e.target.value)} name="password" placeholder="Wachtwoord" icon="key" />
					<Button onClick={(e) => { user.login(username, password, history, '/'); e.preventDefault(); }}>Log in</Button>

					<Errors user={user} />
				</form>
			</div>
		</section>
	);
}
