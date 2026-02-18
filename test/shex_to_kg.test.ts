import { describe, it, expect } from 'bun:test';
import { handleNodeConstraint, Kind, quadToString } from '../lib/shex_to_kg';
import type { NodeConstraint, valueSetValue } from 'shexj';
import { DataFactory } from 'rdf-data-factory';
import * as RDF from '@rdfjs/types';

const DF = new DataFactory<RDF.Quad>();

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
