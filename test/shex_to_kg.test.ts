import { describe, it, expect } from 'bun:test';
import { inspect } from 'util';
import {
  handleNodeConstraint,
  handleShape,
  Kind,
  mergeKg,
  mergeUnionKg,
  quadToString,
  type IKG,
  type IKGConstraint,
} from '../lib/shex_to_kg';
import type { NodeConstraint, ShapeOr, Shape, EachOf, valueSetValue } from 'shexj';
import { DataFactory } from 'rdf-data-factory';
import * as RDF from '@rdfjs/types';
import { isomorphic } from 'rdf-isomorphic';
import * as Shex from '@shexjs/parser';
import { isResult, type IResult } from 'result-interface';

const DF = new DataFactory<RDF.Quad>();
const SHEX_PARSER = Shex.construct('');

describe(handleNodeConstraint.name, () => {
  const subject = DF.namedNode('s');
  const predicate = DF.namedNode('p');
  const expectedQuads: [RDF.Quad] = [
    DF.quad(subject, predicate, DF.blankNode(`${subject.value}-${predicate.value}`)),
  ];

  it('should return a knowledge graph with no constraint given an empty node constraint', () => {
    const node: NodeConstraint = {
      type: 'NodeConstraint',
    };
    const kg = handleNodeConstraint(node, subject, predicate);

    expect(kg.constraints.size).toBe(1);
    expect(kg.constraints.get(quadToString(expectedQuads[0]))).toBeArrayOfSize(0);
    expect(kg.unionStatement).toBeArrayOfSize(0);
    expect(kg.statements).toEqual(expectedQuads);
  });

  it('should return a knowledge graph with a constraint given a node constraint with a node nodeKind constraint', () => {
    const node: NodeConstraint = {
      type: 'NodeConstraint',
      nodeKind: 'bnode',
    };
    const kg = handleNodeConstraint(node, subject, predicate);

    expect(kg.constraints.size).toBe(1);
    const constraints = kg.constraints.get(quadToString(expectedQuads[0]));
    expect(constraints).toBeArrayOfSize(1);
    expect(constraints![0]).toEqual({
      statement: expectedQuads[0],
      kind: Kind.NODE_KIND,
      constraint: 'bnode',
    });
    expect(kg.unionStatement).toBeArrayOfSize(0);
    expect(kg.statements).toEqual(expectedQuads);
  });

  it('should return a knowledge graph with a constraint given a node constraint with a node datatype constraint', () => {
    const node: NodeConstraint = {
      type: 'NodeConstraint',
      datatype: 'anIri',
    };
    const kg = handleNodeConstraint(node, subject, predicate);

    expect(kg.constraints.size).toBe(1);
    const constraints = kg.constraints.get(quadToString(expectedQuads[0]));
    expect(constraints).toBeArrayOfSize(1);
    expect(constraints![0]).toEqual({
      statement: expectedQuads[0],
      kind: Kind.DATA_TYPE,
      constraint: 'anIri',
    });
    expect(kg.unionStatement).toBeArrayOfSize(0);
    expect(kg.statements).toEqual(expectedQuads);
  });

  it('should return a knowledge graph with a constraint given a node constraint with a node value set constraint', () => {
    const values: valueSetValue[] = [
      'aaa',
      { type: 'IriStem', stem: 'aa' },
      { value: 'b', language: 'Frans', type: 'type' },
    ];
    const node: NodeConstraint = {
      type: 'NodeConstraint',
      values,
    };
    const kg = handleNodeConstraint(node, subject, predicate);

    expect(kg.constraints.size).toBe(1);
    const constraints = kg.constraints.get(quadToString(expectedQuads[0]));
    expect(constraints).toBeArrayOfSize(1);
    expect(constraints![0]).toEqual({
      statement: expectedQuads[0],
      kind: Kind.VALUE_SET,
      constraint: values,
    });
    expect(kg.unionStatement).toBeArrayOfSize(0);
    expect(kg.statements).toEqual(expectedQuads);
  });
});

describe(mergeUnionKg.name, () => {
  it('should add a union statement in the first graph', () => {
    const prevKg: IKG = {
      statements: [],
      unionStatement: [],
      constraints: new Map(),
    };
    const firstKg: IKG = {
      statements: [
        DF.quad(DF.blankNode(), DF.namedNode('foo'), DF.blankNode()),
        DF.quad(DF.blankNode(), DF.namedNode('bar'), DF.blankNode()),
      ],
      unionStatement: [prevKg],
      constraints: new Map([
        [
          'a',
          [
            {
              statement: DF.quad(DF.blankNode(), DF.namedNode('foo'), DF.blankNode()),
              kind: Kind.NODE_KIND,
              constraint: 'iri',
            },
          ],
        ],
      ]),
    };

    const otherKg: IKG = {
      statements: [
        DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
        DF.quad(DF.blankNode(), DF.namedNode('bar1'), DF.blankNode()),
      ],
      unionStatement: [],
      constraints: new Map([
        [
          'b',
          [
            {
              statement: DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
              kind: Kind.NODE_KIND,
              constraint: 'iri',
            },
          ],
        ],
      ]),
    };

    mergeUnionKg(firstKg, otherKg);

    expect(firstKg.unionStatement).toEqual([prevKg, otherKg]);
  });
});

describe(mergeKg.name, () => {
  it('should merge two KGs', () => {
    const prevKg: IKG = {
      statements: [],
      unionStatement: [],
      constraints: new Map(),
    };
    const firstKg: IKG = {
      statements: [
        DF.quad(DF.blankNode(), DF.namedNode('foo'), DF.blankNode()),
        DF.quad(DF.blankNode(), DF.namedNode('bar'), DF.blankNode()),
      ],
      unionStatement: [prevKg],
      constraints: new Map([
        [
          'a',
          [
            {
              statement: DF.quad(DF.blankNode(), DF.namedNode('foo'), DF.blankNode()),
              kind: Kind.NODE_KIND,
              constraint: 'iri',
            },
          ],
        ],
      ]),
    };

    const otherKg: IKG = {
      statements: [
        DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
        DF.quad(DF.blankNode(), DF.namedNode('bar1'), DF.blankNode()),
      ],
      unionStatement: [],
      constraints: new Map([
        [
          'a',
          [
            {
              statement: DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
              kind: Kind.NODE_KIND,
              constraint: 'iri',
            },
          ],
        ],
        [
          'b',
          [
            {
              statement: DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
              kind: Kind.NODE_KIND,
              constraint: 'iri',
            },
          ],
        ],
      ]),
    };

    mergeKg(firstKg, otherKg);

    const expectedStatement = [
      DF.quad(DF.blankNode(), DF.namedNode('foo'), DF.blankNode()),
      DF.quad(DF.blankNode(), DF.namedNode('bar'), DF.blankNode()),
      DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
      DF.quad(DF.blankNode(), DF.namedNode('bar1'), DF.blankNode()),
    ];

    const expectedConstraints: Map<string, IKGConstraint[]> = new Map([
      [
        'a',
        [
          {
            statement: DF.quad(DF.blankNode(), DF.namedNode('foo'), DF.blankNode()),
            kind: Kind.NODE_KIND,
            constraint: 'iri',
          },
          {
            statement: DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
            kind: Kind.NODE_KIND,
            constraint: 'iri',
          },
        ],
      ],
      [
        'b',
        [
          {
            statement: DF.quad(DF.blankNode(), DF.namedNode('foo1'), DF.blankNode()),
            kind: Kind.NODE_KIND,
            constraint: 'iri',
          },
        ],
      ],
    ]);

    expect(isomorphic(firstKg.statements, expectedStatement)).toBe(true);
    expect(firstKg.unionStatement).toEqual([prevKg]);
    equalConstrainst(firstKg.constraints, expectedConstraints);
  });
});

describe(handleShape.name, () => {
  it('should handle a shape with only predicate definition', () => {
    const subject = DF.namedNode('foo');

    const shapeString = `
      <http://a.example/S1> {
        <http://a.example/p1> [1 2];
        <http://a.example/p2> IRI;
      }`;
    const schema = SHEX_PARSER.parse(shapeString);
    const shape: Shape = schema?.shapes![0]?.shapeExpr as Shape;
    expect(shape.type).toBe('Shape');
    const statements = [
      DF.quad(subject, DF.namedNode('http://a.example/p1'), DF.blankNode()),
      DF.quad(subject, DF.namedNode('http://a.example/p2'), DF.blankNode()),
    ];

    const firstConstraint: IKGConstraint = {
      statement: statements[0]!,
      kind: Kind.VALUE_SET,
      constraint: [
        {
          value: '1',
          type: 'http://www.w3.org/2001/XMLSchema#integer',
        },
        {
          value: '2',
          type: 'http://www.w3.org/2001/XMLSchema#integer',
        },
      ],
    };

    const secondConstraint: IKGConstraint = {
      statement: statements[1]!,
      kind: Kind.NODE_KIND,
      constraint: 'iri',
    };

    const expectedKg: IKG = {
      statements,
      unionStatement: [],
      constraints: new Map([
        [quadToString(statements[0]!), [firstConstraint]],
        [quadToString(statements[1]!), [secondConstraint]],
      ]),
    };

    const resp = handleShape(shape, subject, new Map()) as IResult<IKG>;

    expect(isResult(resp)).toBe(true);
    expect(isomorphic(resp.value.statements, expectedKg.statements)).toBe(true);
    expect(resp.value.unionStatement).toBeArrayOfSize(0);
    equalConstrainst(resp.value.constraints, expectedKg.constraints);
  });

  it('should handle a shape with choice predicates', () => {
    const subject = DF.namedNode('foo');

    const shapeString = `
      <http://a.example/S1> {
        (
           <http://a.example/name> LITERAL

          |
            <http://a.example/givenName> LITERAL+;
            <http://a.example/familyName> LITERAL
        );
        <http://a.example/mbox> IRI
      }`;
    const schema = SHEX_PARSER.parse(shapeString);
    const shape: Shape = schema?.shapes![0]?.shapeExpr as Shape;
    expect(shape.type).toBe('Shape');

    const statements = [DF.quad(subject, DF.namedNode('http://a.example/mbox'), DF.blankNode())];
    const unionStatement: IKG[] = [
      {
        statements: [DF.quad(subject, DF.namedNode('http://a.example/name'), DF.blankNode())],
        unionStatement: [],
        constraints: new Map([
          [
            '1',
            [
              {
                statement: DF.quad(subject, DF.namedNode('http://a.example/name'), DF.blankNode()),
                kind: Kind.NODE_KIND,
                constraint: 'literal',
              },
            ],
          ],
        ]),
      },
      {
        statements: [
          DF.quad(subject, DF.namedNode('http://a.example/givenName'), DF.blankNode()),
          DF.quad(subject, DF.namedNode('http://a.example/familyName'), DF.blankNode())
        ],
        unionStatement: [],
        constraints: new Map([
          [
            '1',
            [
              {
                statement: DF.quad(subject, DF.namedNode('http://a.example/givenName'), DF.blankNode()),
                kind: Kind.NODE_KIND,
                constraint: 'literal',
              },
            ],
          ],
          [
            '2',
            [
              {
                statement: DF.quad(subject, DF.namedNode('http://a.example/familyName'), DF.blankNode()),
                kind: Kind.NODE_KIND,
                constraint: 'literal',
              },
            ],
          ],
        ]),
      },
    ];

    const expectedKg: IKG = {
      statements,
      unionStatement,
      constraints: new Map([
        [
          '1',
          [
            {
              statement: DF.quad(subject, DF.namedNode('http://a.example/mbox'), DF.blankNode()),
              kind: Kind.NODE_KIND,
              constraint: 'iri',
            },
          ],
        ],
      ]),
    };

    const resp = handleShape(shape, subject, new Map()) as IResult<IKG>;

    expect(isResult(resp)).toBe(true);
    expect(isomorphic(resp.value.statements, expectedKg.statements)).toBe(true);
    equalConstrainst(resp.value.constraints, expectedKg.constraints);
    expect(resp.value.unionStatement).toBeArrayOfSize(2);
    for (const [i, kg] of resp.value.unionStatement.entries()) {
      expect(isomorphic(kg.statements, expectedKg.unionStatement[i]?.statements!)).toBe(true);
      equalConstrainst(kg.constraints, expectedKg.unionStatement[i]?.constraints!);
    }
  });

  it('should handle nested shapes', () => {
    const subject = DF.namedNode('foo');

    const shapeString = `
      PREFIX ex: <http://a.example/>

      ex:IssueShape {
      ex:state [ex:unassigned ex:assigned];
      ex:reportedBy {
        ex:name LITERAL;
        ex:mbox IRI+
      }
    }`;
    const schema = SHEX_PARSER.parse(shapeString);
    const shape: Shape = schema?.shapes![0]?.shapeExpr as Shape;
    expect(shape.type).toBe('Shape');
    const statements = [
      DF.quad(subject, DF.namedNode('http://a.example/state'), DF.blankNode()),
      DF.quad(subject, DF.namedNode('http://a.example/reportedBy'), DF.namedNode(`sub-${subject.value}`)),
      DF.quad(DF.namedNode(`sub-${subject.value}`), DF.namedNode('http://a.example/name'), DF.blankNode()),
      DF.quad(DF.namedNode(`sub-${subject.value}`), DF.namedNode('http://a.example/mbox'), DF.blankNode())
    ];

    const expectedKg: IKG = {
      statements,
      unionStatement:[],
      constraints: new Map([
        [
          '1',
          [
            {
              statement: DF.quad(subject, DF.namedNode('http://a.example/mbox'), DF.blankNode()),
              kind: Kind.NODE_KIND,
              constraint: 'iri',
            },
          ],
        ],
      ]),
    };

    const resp = handleShape(shape, subject, new Map()) as IResult<IKG>;

    expect(isResult(resp)).toBe(true);
    expect(isomorphic(resp.value.statements, expectedKg.statements)).toBe(true);
    equalConstrainst(resp.value.constraints, expectedKg.constraints);
    expect(resp.value.unionStatement).toBeArrayOfSize(0);

  });


});

function equalConstrainst(
  first: Map<string, IKGConstraint[]>,
  second: Map<string, IKGConstraint[]>,
): void {
  const firstAll = [...first.values()].flat();
  const secondAll = [...second.values()].flat();

  expect(firstAll.length).toBe(secondAll.length);

  for (const constraint of firstAll) {
    const match = secondAll.find(
      (c) => isomorphic([constraint.statement], [c.statement]) && constraint.kind === c.kind,
    );
    expect(
      match,
      `No match found for constraint:\n${inspect(constraint, { depth: null })}\n\nAvailable in second:\n${inspect(secondAll, { depth: null })}`,
    ).toBeDefined();

    const firstIsArray = Array.isArray(constraint.constraint);
    const secondIsArray = Array.isArray(match!.constraint);
    expect(firstIsArray, `Constraint type mismatch for:\n${inspect(constraint, { depth: null })}\n\nMatched:\n${inspect(match, { depth: null })}`).toBe(secondIsArray);

    if (firstIsArray) {
      equalValueSets(
        constraint.constraint as valueSetValue[],
        match!.constraint as valueSetValue[],
      );
    } else {
      expect(constraint.constraint).toBe(match!.constraint);
    }
  }
}

function equalValueSets(first: valueSetValue[], second: valueSetValue[]): void {
  expect(first.length).toBe(second.length);
  for (const val of first) {
    expect(second).toContainEqual(val);
  }
}
