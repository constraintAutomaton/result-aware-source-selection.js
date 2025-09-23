import { translate } from "sparqlalgebrajs";

const query =`
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?name
WHERE {
  ?person a foaf:Person ;
  FILTER (lang(?name) = "en")
}`;

const alg = translate(query);

console.log(JSON.stringify(alg,null, 2));