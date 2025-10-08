export default class OAuth {
    cookiePrefix = "oauth_";

    constructor(opt) {
        this.server = opt.server;
        this.reset_hash = this.getPasswordResetHash();
        this.client_id = opt.client_id || null;
        this.redirect_uri = opt.redirect_uri || window.location.href.split('#')[0];
        this.audience = opt.audience || null;
        this.response_type = opt.response_type || 'token';
        this.scope = opt.scope || 'openid';
        this.state = this.getCookie('state');
        if (this.state) this.validate();
    }
    getDomainRoot() {
        //var port = (window.location.port !== 80 || window.location.port !== 443) ? ":" + window.location.port : "";
        return window.location.protocol + "//" + window.location.host;
    }
    getPasswordResetHash() {
        var hash = window.location.hash;
        //let matches = [...hash.matchAll()];
        let resethash = false;
        hash.replace(/#reset=(.*)$/g, function (match, g1, g2) {
            resethash = decodeURIComponent(g1);
            //window.history.replaceState(window.history.state, document.title, window.location.href.split('#')[0]);
        });
        return resethash;
    }

    async refresh() {
        var token = this.getCookie('refreshToken');
        var uid = this.getCookie('uid');
        if (token && uid) {
            var options = {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, token }),
            };
            var url = this.server + '/refresh';
            var data = await fetch(url, options).then(res => res.json());
            this.setToken(data);
            return data;
        } else {
            return false;
        }
    }
    async reset(username, password = false) {
        var options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: password !== false ? JSON.stringify({ username, password, hash: this.reset_hash }) : JSON.stringify({ username }),
        };
        var url = this.server + '/reset' + (password === false ? '?redirect=' + encodeURIComponent(this.getDomainRoot() + "/account/reset/hash") : '');
        var data = await fetch(url, options).then(res => res.json());
        if (data.success) this.reset_hash = false;
        return data;
    }
    async signup(username, password) {
        var options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        };
        console.log(this.getDomainRoot() + "/account/login#activated");
        var url = this.server + '/signup?redirect=' + encodeURIComponent(this.getDomainRoot() + "/account/login#activated");
        var data = await fetch(url, options).then(res => res.json());
        return data;
    }
    async login(username, password) {
        var options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        };
        var url = this.server + '/login';
        var data = await fetch(url, options).then(res => res.json());
        return data;
    }
    async delete(username, password) {
        var options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        };
        var url = this.server + '/delete';
        var data = await fetch(url, options).then(res => res.json());
        return data;
    }
    async getToken(stayhere = false) {
        var token = this.getCookie('token');
        if (!token) {
            var result = await this.refresh();
            if (!result || result.error) {
                if (stayhere) {
                    return result.error;
                }
                this.authorize();
            }

            token = this.getCookie('token');
        }
        return token
    }
    validate() {
        var hash = window.location.hash.substr(1);
        var result = hash.split('&').reduce(function (result, item) {
            var parts = item.split('=');
            result[parts[0]] = decodeURIComponent(parts[1]);
            return result;
        }, {});
        if (result) {
            if (result.state === this.state) {
                this.setCookie("state", "", 0);
                window.location.hash = "";
                this.setToken(result);
            }
        }
    }
    setToken(result) {
        var maxAge = result.expires_in || result.accessTokenExpirationSeconds || 1;
        var refreshMaxAge = maxAge === 1 ? 1 : 3600 * 24 * 30; //30 days
        var token = result.access_token || result.idToken || "";
        var refreshToken = result.refresh_token || result.refreshToken || "";
        var uid = result.uid || "";
        this.setCookie("token", token, maxAge);
        this.setCookie("refreshToken", refreshToken, refreshMaxAge);
        this.setCookie("uid", uid, refreshMaxAge);
    }
    authorize() {
        this.nonce = this.generateRandomString();
        this.state = this.generateRandomString();
        this.setCookie("state", this.state);
        var qs = "";
        Object.keys(this).forEach(key => {
            if (key === "cookiePrefix" || key === "server" || this[key] === null) return;
            qs += (qs ? "&" : "") + key + '=' + encodeURIComponent(this[key]);

        })
        window.location.href = this.server + '/authorize?' + qs;
    }
    generateRandomString() {
        return window.btoa((Math.random() * 6452421).toString());
    }
    getCookie(name) {
        var regex = new RegExp('(?:(?:^|.*;\\s*)' + this.cookiePrefix + name + '\\s*\\=\\s*([^;]*).*$)|^.*$');
        return document.cookie.replace(regex, "$1");
    }
    setCookie(name, value, maxAgeInSeconds = 300) {
        document.cookie = this.cookiePrefix + name + "=" + value + ";path=/;max-age=" + maxAgeInSeconds.toString();
    }
}