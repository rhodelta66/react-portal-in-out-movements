import React, { useContext } from 'react';
import { NavLink } from "react-router-dom";
import { UserContext } from './services/UserContext'
import logo from './img/rws.jpeg';

export default function Header() {
    const user = useContext(UserContext);
    //    console.log(user.authenticated);
    return (
        <header>
            <nav className="navbar navbar-expand-md navbar-light  border-bottom border-primary">
                <div className="container" data-toggle="collapse" data-target=".navbar-collapse.show">
                    <button className="navbar-toggler navbar-toggler-right border-0" type="button" data-toggle="collapse" data-target="#navbar3">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <img src={logo} alt="Logo" style={{maxHeight:'32px'}} className="ml-3 d-block d-sm-none" />
                    <img src={logo} alt="Logo" style={{maxHeight:'48px'}} className="mx-2 d-none d-sm-block" />
                    <NavLink activeClassName="active" exact className="nav-link text-secondary h2 mb-1 m-0 p-0 font-weight-normal" to="/"><em>Rotterdam Warehouse Solutions</em></NavLink>
                    <div className="px-4 collapse navbar-collapse text-center justify-content-start" id="navbar3">
                        <ul className="navbar-nav">
                            {
                                user.authenticated ?
                                    <>
                                        <li className="nav-item mx-2"><span className="nav-link text-muted">{user.claims.sub}</span></li>
                                        <li className="nav-item mx-2"><NavLink onClick={user.logOut} activeClassName="active" to="/" className="nav-link">Log uit</NavLink></li>
                                    </>
                                    :
                                    <li className="nav-item mx-2"><NavLink activeClassName="active" className="nav-link" to="/account/login">Log in</NavLink></li>
                            }
                        </ul>
                    </div>
                </div>
            </nav>
        </header>
    );
}
