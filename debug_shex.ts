import * as Shex from '@shexjs/parser';

const parser = Shex.construct('');

const data = `
  PREFIX ex: <http://example.org/>
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

  ex:PersonShape @ex:EmailShape OR @ex:PhoneShape

  ex:EmailShape {
    ex:email xsd:string ;
  }

  ex:PhoneShape {
    ex:phone xsd:string ;
  }
`;


const otherversion = `
  PREFIX ex: <http://example.org/>
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

  ex:PersonShape {
    ex:email xsd:string ;
  } OR {
    ex:phone xsd:string ;
  }

`;

const resp = parser.parse(data);

console.log(JSON.stringify(resp, null, 2));
