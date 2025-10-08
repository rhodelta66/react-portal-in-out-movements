import React from 'react';
import FooterInner from './FooterInner';

export default function Footer() {
    return (
        <footer>
            <div className="border-top border-primary">
                <div className="container">
                    <FooterInner />
                    <div className="row">
                        <div className="col-md-12">
                            <p className="text-center">&copy; {(new Date()).getFullYear()} <a href="https://wmsx.nl" target="_blank">Tracy Data Solutions B.V.</a></p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
