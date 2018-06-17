const Router = require('express-promise-router');
const router = new Router();

const db_url = "postgres://cvbxymodwgcdog:6ca64c4362716069e239320eec8ae06097e66f573126ae33027e5e593fe663d2@ec2-54-243-235-153.compute-1.amazonaws.com:5432/d6i5mdoncrqtm0";
const { Client } = require('pg');

var bodyParser = require('body-parser');
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({extended: true}));

module.exports = router;

router.get('/', async (req, res, next) => {
  const client = new Client({ connectionString: db_url, ssl: true });
  client.connect();

  var queryString = 'SELECT * FROM entry';

  try {
    const { rows } = await client.query(queryString);
    res.json(rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).send('Error while retrieving entries'); //could make more specific
  }
  client.end();
});

router.get('/:term', async (req, res, next) => {
//return entries with author id or name and identity???

  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  const client = new Client({ connectionString: db_url, ssl: true });
  client.connect();

  //join inner/outer for where author is null?

  //get entries that match the term or synonyms
  var queryString = 'SELECT * FROM entry INNER JOIN author ON entry.author = author.author_id WHERE term = $1 OR term IN (SELECT sort_as FROM synonym WHERE term = $1) ';
  //var authorQueryString = 'SLECT name, identity FROM author WHERE author_id = $1'

  try {
    const { rows } = await client.query(queryString, [req.params.term]);
    console.log(rows);
    res.json(rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).send('Error while retrieving entries'); //could make more specific
  }
  client.end();
});


router.post('/', async (req, res) => {
  const client = new Client({ connectionString: db_url, ssl: true });
  client.connect();

  const {term, definition} = req.body;
  name = req.body.name ? req.body.name : '';
  identity = req.body.identity ? req.body.identity : '';
  explanation = req.body.explanation ? req.body.explanation : '';

  var termQueryString = 'INSERT INTO term(term) SELECT CAST($1 AS VARCHAR) WHERE NOT EXISTS (SELECT 1 FROM term WHERE term = $1);';
  var authorQueryString = 'INSERT INTO author(name, identity) SELECT CAST($1 AS VARCHAR),CAST($2 AS VARCHAR) WHERE NOT EXISTS (SELECT 1 FROM author WHERE name = $1 AND identity = $2) RETURNING author_id;';
  //var authorQueryString = 'INSERT INTO author(name, identity) SELECT CAST($1 AS VARCHAR),CAST($2 AS VARCHAR) WHERE NOT EXISTS (SELECT name, identity FROM author INTERSECT SELECT $1, $2) RETURNING author_id;';
  var authorIdQueryString = 'SELECT author_id FROM author WHERE name = $1 AND identity = $2;';
  var entryQueryString = 'INSERT INTO entry(term, definition, explanation, author) SELECT CAST($1 AS VARCHAR),CAST($2 AS VARCHAR),CAST($3 AS VARCHAR),$4 WHERE NOT EXISTS (SELECT 1 FROM entry WHERE term = $1 AND definition = $2 AND explanation = $3 AND author = $4);';

  try {
    //insert term
    await client.query(termQueryString, [term]);
    //insert author & get id
    var result = await client.query(authorQueryString, [name, identity]);
    if (result.rows.length === 0) {
      result = await client.query(authorIdQueryString, [name, identity]);
    }
    const author_id = result.rows[0]["author_id"];
    // //insert entry!
    await client.query(entryQueryString, [term, definition, explanation, author_id]);
    res.send("Inserted entry for term: " + term);
  } catch (err) {
    console.error(err.stack);
    res.status(500).send('Error while inserting entry'); //could make more specific
  }

  client.end();

});