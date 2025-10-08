import React, { useContext, useState, useEffect } from 'react';
import Title from "../Title";
import { UserContext } from '../services/UserContext'
import { Input, Button, Errors } from '../Forms'

export default function ({ history }) {
	const [username, setUsername] = useState("");
//	const [password, setPassword] = useState(false);
	const user = useContext(UserContext);

	useEffect(() => {
		if (user.authenticated) {
			history.push('/');
		}
	}, [user.authenticated, history]);
	return (
		<section>
			<Title>Reset wachtwoord</Title>
			<div className="mx-auto col-lg-4 col-md-6 mb-4 text2-center">
				{user.success === "" ?
					<form>
						<Input type="email" link={{ to: '/account/login', text: 'Terug naar login' }} onChange={e => setUsername(e.target.value)} name="username" placeholder="E-mailadres" icon="envelope" />
						<Button onClick={(e) => { user.reset(username); e.preventDefault(); }}>Reset wachtwoord</Button>
					</form>
					: ""
				}
				<Errors user={user} />
			</div>
		</section>
	);
}