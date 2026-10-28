/**
 * ClinicalStore: Encapsulated database connection holder.
 * Step 5: Holds the admin connection in a JavaScript private field (#db).
 * It is the ONLY code in the repository using that connection and is NOT exported from index.js.
 */

import { getClinicalConnection } from './connection.js';

export class ClinicalStore {
  #db;

  constructor(customConnection = null) {
    this.#db = customConnection || getClinicalConnection();
  }

  get sql() {
    return this.#db;
  }
}
