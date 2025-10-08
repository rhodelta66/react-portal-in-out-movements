import React from 'react';
import Title from "./Title";
import Head from './Head';
//import Person from "./Person";

//import {Person3 as Person} from "./Person";


export default function () {
    return (
        <section>
            <div className="row">
                <div className="col-lg-6">
                    <Title>Contact</Title>
                    <p className="lead">Alle contactinformatie vindt u altijd onderin iedere pagina.</p>
                </div>
                <div className="col-lg-6">
                    <Head>Kaart</Head>
                    <iframe title="Google Maps" width="100%" height="400" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2454.743941713082!2d4.2337754157892284!3d52.02976227972433!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c5b3d55a962075%3A0x5bcb05e7f0f5868d!2sTracy+Data+Solutions+B.V.!5e0!3m2!1snl!2snl!4v1559652885875!5m2!1snl!2snl" scrolling="no" frameBorder="0" className="border-primary border"></iframe>
                </div>
            </div>
        </section>
    );
}
