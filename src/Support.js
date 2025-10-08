import React from 'react';
import Title from "./Title";
import Blok from "./Blok";

export default function () {
    return (
        <section>
            <Title>Support</Title>
            <div className="row m-0">
                <Blok title="Remote desktop" icon="desktop">
                    Na uw goedkeuring, kunnen wij uw desktop op afstand overnemen om support te bieden.<br /><br />
                    <a target="_blank"  rel="noopener noreferrer" href="https://my.splashtop.com/team_deployment/download/2HK5ASZYS242">Installeer hier de client</a>
                </Blok>
                <Blok title="Telefonisch" icon="phone">
                    Vanzelfsprekend zijn we voor support telefonisch bereikbaar op: <br/><br/> <a href="tel:+31107441813">+31 10 744 18 13</a>.
                </Blok>
            </div>
        </section>
    );
}
