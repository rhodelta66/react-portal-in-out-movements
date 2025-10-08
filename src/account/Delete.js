import React, { useContext, useState } from 'react';
import Title from "../Title";
import { UserContext } from '../services/UserContext'
import { Input, Button, Errors } from '../Forms'
import { NavLink } from "react-router-dom";

export default function ({ history }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const user = useContext(UserContext);
	return (
		<section>
			<Title>Account verwijderen</Title>
			<div className="mx-auto col-lg-4 col-md-6 mb-4 text2-center">
				{user.success === "" ?
					<form>
						<Input type="email" link={{ to: '/account/user', text: 'Terug' }} onChange={e => setUsername(e.target.value)} name="username" placeholder="E-mailadres" icon="envelope" />
						<Input type="password" onChange={e => setPassword(e.target.value)} name="password" placeholder="Wachtwoord" icon="key" />
						<Button onClick={(e) => { user.delete(username, password, history, '/'); e.preventDefault(); }}>Verwijder</Button>
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
