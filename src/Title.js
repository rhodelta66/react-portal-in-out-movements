import React from 'react';
import Head from "./Head";

export default function Title({ children }) {
    document.title = children + " - Tracy";
    //useEffect(() => { document.title = children + " - Tracy"; }, []);
    return (
        <Head>{children}</Head>
    );
}
