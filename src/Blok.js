import React from 'react';

export default function ({ title, icon, children, full }) {
	return (
		<>
			<div className={"d-block d-sm-none"}>
				<div className="row">
					<div className="col mb-4">
						<h3 className="text-primary">{title}</h3>
						<p><i className={"float-left mr-1 mb-1 fa fa-fw text-primary fa-4x fa-" + icon}></i>{children}</p>
					</div>
				</div>
			</div>
			<div className={"d-none d-sm-block" + (full ? ' col-md-12' : ' col-md-6')}>
				<div className="row mb-4">
					<div className={full ? 'col-md-1' : 'col-md-2'}><i className={"fa fa-fw text-primary fa-3x fa-" + icon}></i></div>
					<div className={full ? 'col-md-11' : 'col-md-10'}>
						<div className="col border-left">
							<h3 className="text-primary">{title}</h3>
							<p className="lead">{children}</p>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
