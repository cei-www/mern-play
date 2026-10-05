// The real app talks to MySQL here (see module "build"). In this module there is no database:
// every test that touches the database replaces this file with a mock.
export const db = {
  query() {
    throw new Error('db.query was called for real. In a unit test, mock src/server/db.js.');
  },
};
