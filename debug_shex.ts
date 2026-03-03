import * as Shex from '@shexjs/parser'

const parser = Shex.construct("");

const data = `
  PREFIX ex: <http://ex.example/#>
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>


  my:IssueShape {
  ex:state [ex:unassigned ex:assigned];
  ex:reportedBy {
    foaf:name LITERAL;
    foaf:mbox IRI+
  }
}`;

const resp = parser.parse(data);

console.log(JSON.stringify(resp, null, 2));
