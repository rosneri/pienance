import type { PieRepository } from "../domain";

/**
 * What the use cases need from the outside world. Each platform (web server,
 * native app, tests) supplies its own: nothing here assumes Node or a browser.
 */
export interface Ports {
  readonly pies: PieRepository;
  readonly newId: () => string;
  readonly now: () => Date;
}
