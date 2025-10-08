import React, { useContext, useState } from 'react';
import Title from "./Title";
import { UserContext } from './services/UserContext'

export default function ({ history }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const user = useContext(UserContext);
	return (
		<section>
			<Title>Account verwijderen</Title>
			<div className="mx-auto col-lg-4 col-md-6 mb-4 text2-center">
				<form>
					<div className="form-group">
						<label htmlFor="username"><i className={"fa fa-fw fa-envelope"}></i> E-mailadres</label>
						<input type="email" onChange={e => setUsername(e.target.value)} name="username" className="form-control form-control-lg" id="username" placeholder="e-mailadres" />
					</div>

					<div className="form-group">
						<label htmlFor="password"><i className={"fa fa-fw fa-key"}></i> Wachtwoord </label>
						<input type="password" onChange={e => setPassword(e.target.value)} name="password" className="form-control form-control-lg" id="password" placeholder="wachtwoord" />
					</div>
					<div className="form-group text-center">
						<button onClick={(e) => { user.delete(username, password, history, '/'); e.preventDefault(); }} type="submit" className="btn btn-primary">Verwijder</button>
					</div>
					{
						user.error ?
							<div className="mt-2 alert alert-danger fadein">
								{user.error}
							</div>
							:
							""
					}
					{
						user.success ?
							<div className="mt-2 alert alert-success fadein">
								{user.success}
							</div>
							:
							""
					}
				</form>
			</div>
		</section>
	);
}
