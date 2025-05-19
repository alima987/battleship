export class Player{
    login: string;
    password: string; 

  constructor (login: string, password: string = '') {
    this.login = login
    this.password = password
  }
  toJSON () {
    return {
      login: this.login,
      password: this.password
    }
  }
  static fromJSON(json: any): Player {
    const { login, password } = json
    return new Player(login, password)
  }
}