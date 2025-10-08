import React, { useEffect } from 'react';
import { NavLink } from "react-router-dom";

export function Input(props) {
	let icon = "";
	let link = "";
	if (props.link) link = <NavLink tabIndex="-1" className="p-0 nav-link float-right" to={props.link.to}><small>{props.link.text}</small></NavLink>
	if (props.icon) icon = <i className={"fa fa-fw fa-" + props.icon} />;
	return (
		<div className="form-group">
			<label htmlFor={props.name}>{icon} {props.placeholder}</label>{link}
			<input {...props} className="form-control form-control-lg" id={props.name} />
		</div>
	);
}
export function Button(props) {
	return (
		<div className="form-group text-center">
			<button  {...props} type="submit" className="btn btn-primary">{props.children}</button>
		</div>
	);
}
export function Errors({ user }) {
	useEffect(() => {
		user.success = "";
		user.error = "";
	}, [user]);
	return (
		<>
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
		</>
	);
}