import React from 'react';

export default function ({name,title,children,icon}) {
	return (
		<div className="col-lg-4 col-md-6 mb-4 text-center">
			<div className="img-fluid mb-2"><i className={"fa fa-5x text-primary fa-"+ icon}></i></div>
			<h4> <b>{name}</b></h4>
			<p>{title}</p>
			<p className="mb-0"> <i>"{children}"</i> </p>
		</div>
	);
}
