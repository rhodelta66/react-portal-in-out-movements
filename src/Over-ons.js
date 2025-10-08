import React from 'react';
import Title from "./Title";
import Head from "./Head";
import Person from "./Person";

export default function () {
    return (
        <section>
            <Title>Over ons</Title>
            <div className="row">
                <div className="col">
                    <p className="lead">Tracy Data Solutions richt zich specifiek op ontwikkeling van web-based software voor importeurs,
                        afladers, exporteurs en groothandel in de AGF branche, en in het bijzonder op klanten
                        die brede ondersteuning nodig hebben qua functionaliteit en flexibiliteit.
                        <br /><br />Inmiddels hebben we meer dan 30 jaar ervaring in de branche.</p>
                </div>
            </div>
            <Head>Het team</Head>
            <div className="row">
                <Person name="Rick Hoek" title="Founder &amp; Lead-Developer" icon="hand-rock-o">
                    rh apenstaartje tracy nu
                </Person>
                <Person name="Jij?" title="Developer" icon="hand-paper-o">
                    soliciteer apenstaartje tracy nu
                </Person>
                <Person name="Geert Bultman" title="Developer" icon="hand-spock-o">
                    gb apenstaartje tracy nu
                </Person>
            </div>

        </section>
    );
}
