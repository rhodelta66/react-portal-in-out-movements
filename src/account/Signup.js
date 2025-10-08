import React, { useContext, useState, useEffect } from 'react';
import Title from "../Title";
import { UserContext } from '../services/UserContext'
import { Input, Button, Errors } from '../Forms'
import { NavLink } from "react-router-dom";

export default function ({ history }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const user = useContext(UserContext);

	useEffect(() => {
		if (user.authenticated) {
			history.push('/');
		}
	}, [user.authenticated, history]);
	return (
		<section>
			<Title>Registreren</Title>
			<div className="mx-auto col-lg-4 col-md-6 mb-4 text2-center">
				{user.success === "" ?
					<form>
						<Input type="email" link={{ to: '/account/login', text: 'Terug naar login' }} onChange={e => setUsername(e.target.value)} name="username" placeholder="E-mailadres" icon="envelope" />
						<Input type="password" onChange={e => setPassword(e.target.value)} name="password" placeholder="Nieuw wachtwoord" icon="key" />
						<Button onClick={(e) => { user.signup(username, password); e.preventDefault(); }}>Registreer</Button>
						<Errors user={user} />
					</form>
					:
					<NavLink tabIndex="-1" className="p-0 nav-link float-right" to="/account/login"><small>Terug naar login</small></NavLink>
				}
			</div>
			<div className="mx-auto col-lg-4 col-md-6 mb-4 text2-center">
				<Errors user={user} />
			</div>
		</section>
	);
}