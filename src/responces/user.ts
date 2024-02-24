export class User {
    login: string;
    password: string;
    constructor(login: string, password: string = '') {
        this.login = login;
        this.password = password;
    }
    toJSON() {
        return {
            login: this.login,
            password: this.password
        };
    }
    static fromJson(json: any): User {
        const { name, password } = json;
        return new User(name, password);
    }

};
