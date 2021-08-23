import { digits } from "./utils_misc"

export enum Team { "ENLIGHTENED", "RESISTANCE", "NONE" }

export class Player {
  nickname: string
  available_invites: number
  energy: number
  xm_capacity: number
  min_ap_for_next_level: number
  min_ap_for_current_level: number
  verified_level: number
  nickMatcher: RegExp
  ap: number
  team: Team
  lvlUpAp: any;
  lvlApProg: number;
  xmRatio: number;
  cls: string;

  constructor({ nickname, available_invites, energy, xm_capacity, ap, team, min_ap_for_current_level, min_ap_for_next_level, verified_level }) {
    this.nickname = nickname;
    this.available_invites = +available_invites
    this.energy = +energy
    this.xm_capacity = +xm_capacity
    this.ap = +ap
    this.team = Team.ENLIGHTENED.toString() === team ? Team.ENLIGHTENED : Team.RESISTANCE

    this.min_ap_for_next_level = +min_ap_for_next_level
    this.min_ap_for_current_level = +min_ap_for_current_level
    this.verified_level = +verified_level
    this.nickMatcher = new RegExp('\\b(' + nickname + ')\\b', 'ig');

    this.lvlUpAp = digits(this.min_ap_for_next_level - ap) ?? 0;
    this.lvlApProg = Math.round((this.ap - this.min_ap_for_current_level) / (this.min_ap_for_next_level - this.min_ap_for_current_level) * 100);
    this.xmRatio = Math.round(this.energy / this.xm_capacity * 100);
    this.cls = this.team === Team.ENLIGHTENED ? 'enl' : 'res';
  }
}
