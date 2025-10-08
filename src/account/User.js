import React, { useContext } from 'react';
import Title from "../Title";
import { UserContext } from '../services/UserContext'
import AccountLogin from './Login';
import { NavLink } from "react-router-dom";

export default function () {
    const user = useContext(UserContext);
   // console.log(Array.isArray(user.claims['role']))

    return (
        user.authenticated ?
            <section>
                <div className="mx-auto col-lg-6 mb-4 clear-fix">

                    <Title>Welkom</Title>
                    <p className="lead">Met een TracyID kun je Tracy Web Services benaderen afhankelijk van welke rechten (claims) er zijn.</p>
                    <p>De volgende claims zijn gedefinieerd voor {user.claims.sub}:</p>
                    {Object.keys(user.claims).map((keyName, key) => (
                        <div key={key} className="list-group-item text-truncate">{keyName}: {Array.isArray(user.claims[keyName])?user.claims[keyName].join(' / '):user.claims[keyName] }</div>
                    ))}
                    <button onClick={(e) => { user.setState({ claims: {} }); user.refresh(); e.preventDefault(); }} className="mt-2 btn btn-primary">Refresh token</button>
                    <NavLink className="mt-1 nav-link float-right" to="/account/delete"><small>Verwijder account</small></NavLink>
                </div>
            </section>
            :
            <AccountLogin />
    );
}
