import React from 'react';

export default function Head({ children }) {
    return (
        <div className="row">
            <div className="col text-center py-3">
                <h1>{children}</h1>
            </div>
        </div>
    );
}
