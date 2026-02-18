import * as RDF from '@rdfjs/types';
import type {
  Schema,
  TripleConstraint,
  Shape,
  ShapeDecl,
  ShapeOr,
  shapeExpr,
  ShapeAnd,
  NodeConstraint,
  nodeKind,
  IRIREF,
  valueSetValue,
} from 'shexj';
import { Visitor } from '@shexjs/visitor';
import { DataFactory } from 'rdf-data-factory';
import { error, isError, isResult, result, type Result } from 'result-interface';

const DF = new DataFactory<RDF.Quad>();

/**
 * Convert a ShEx schema into a knowledge graph.
 * We suppose that no shape have to be imported and every shapes are closed.
 * @param {Schema} schema A ShEx schema.
 * @returns {Result<IKG, string>} The resulting knowledge graph.
 */
export function shex_to_kg(schema: Schema): Result<IKG, string> {
  const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraints: new Map(),
  };

  if (schema.shapes === undefined) {
    return result(kg);
  }
  const availableShapes: Map<string, ShapeDecl> = new Map(schema.shapes.map((el) => [el.id, el]));

  for (const shape of schema.shapes) {
    const res = shape_to_kg(shape, availableShapes);
    if (isError(res)) {
      return res;
    }
    mergeKg(kg, res.value);
  }
  return result(kg);
}

/**
 * Convert a shape to a knowledge graph.
 * @param {ShapeDecl} shape A shape to convert into a kg.
 * @param {Map<string, ShapeDecl>} availableShapes the shapes that are available in the schema
 * @returns {Result<IKG, string>} - The resulting knowledge graph.
 */
export function shape_to_kg(
  shape: ShapeDecl,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  const subject = DF.namedNode(shape.id);
  const kg = shape_to_kg_subject(shape, subject, availableShapes);
  return kg;
}
/**
 * Convert a shape to a knowledge graph.
 * @param {ShapeDecl} shape A shape to convert into a kg.
 * @param {RDF.NamedNode} subject The subject term of the main star pattern defined by the shape.
 * @param {Map<string, ShapeDecl>} availableShapes The shapes that are available in the schema.
 * @returns {Result<IKG, string>} - The resulting knowledge graph.
 */
function shape_to_kg_subject(
  shape: ShapeDecl,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraints: new Map(),
  };
  // we ignore restricts

  if (shape.shapeExpr === undefined) {
    return result(kg);
  }

  handleShapeExpression(shape.shapeExpr, subject, availableShapes);
  return result(kg);
}
/**
 * Create a function that visit a triple pattern constraints and convert it into a knowledge graph
 * @param kg 
 * @param subject 
 * @param availableShapes 
 * @returns 

function visitTripleConstraintInjectKg(
  kg: IKG,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>
): (el: any) => void {
  return (el) => {
    const constraint = <TripleConstraint>el;
    const predicate = DF.namedNode(constraint.predicate);
    const expression = constraint.valueExpr;
    // the case where constraint is not
    if (expression !== undefined && typeof expression !== "string") {
    } else if (typeof expression === "string") {
      const resultNewKg = handleShapeDeclarationRef(
        expression,
        subject,
        predicate,
        availableShapes
      );
      if (isResult(resultNewKg)) {
        mergeKg(kg, resultNewKg.value);
      }
    } else if (expression === undefined) {
      // we suppose that in that case it can be anything
      // This case should not really happen in practice
      const triple = DF.quad(subject, predicate, DF.blankNode());
      kg.statements.push(triple);
    }
  };
}
 */

export function quadToString(quad: RDF.Quad): string {
  return `${quad.subject.value}-${quad.predicate.value}-${quad.object.value}`;
}

/**
 * Convert a node constraint into a knowledge graph.
 * It does not handle when a NodeConstraint has multiple constraint because it should not happen.
 * @param {NodeConstraint} node A node constraint.
 * @param {RDF.NamedNode} subject The subject of the triple.
 * @param {RDF.NamedNode} predicate The predicate of the triple.
 * @returns {Result<IKG, string>} - The resulting knowledge graph.
 */
export function handleNodeConstraint(
  node: NodeConstraint,
  subject: RDF.NamedNode,
  predicate: RDF.NamedNode,
): IKG {
  const quad = DF.quad(subject, predicate, DF.blankNode(`${subject.value}-${predicate.value}`));
  const constraints: Map<string, IKGConstraint[]> = new Map();
  constraints.set(quadToString(quad), []);

  const entry = constraints.get(quadToString(quad))!;

  if (node.nodeKind !== undefined) {
    const nodeConstraint: IKGConstraint = {
      kind: Kind.NODE_KIND,
      statement: quad,
      constraint: node.nodeKind,
    };
    entry.push(nodeConstraint);
  } else if (node.datatype !== undefined) {
    const dataTypeConstraint: IKGConstraint = {
      statement: quad,
      kind: Kind.DATA_TYPE,
      constraint: node.datatype,
    };
    entry.push(dataTypeConstraint);
  } else if (node.values !== undefined) {
    const valueConstraint: IKGConstraint = {
      statement: quad,
      kind: Kind.VALUE_SET,
      constraint: node.values,
    };
    entry.push(valueConstraint);
  }

  const kg: IKG = {
    statements: [quad],
    unionStatement: [],
    constraints,
  };

  return kg;
}

function handleShapeExpression(
  shape: shapeExpr,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode,
): IKG {
  return {
    statements: [],
    unionStatement: [],
    constraints: new Map(),
  };
}

function handleShape(
  shape: Shape,
  subject: RDF.Quad,
  availableShapes: Map<string, ShapeDecl>,
): IKG {
  const statements: RDF.Quad[] = [];
  if (shape.extra !== undefined) {
    for (const iri of shape.extra) {
      const quad = DF.quad(subject, DF.namedNode(iri), DF.blankNode());
      statements.push(quad);
    }
  }

  // we are ignoring extend for now

  if (shape.expression !== undefined) {
    if (typeof shape.expression === 'string') {
      const quad = DF.quad(subject, DF.namedNode(shape.expression), DF.blankNode());
      statements.push(quad);
    } else {
    }
  }

  const kg: IKG = {
    statements,
    unionStatement: [],
    constraints: new Map(),
  };

  return kg;
}

function handleShapeDeclarationRef(
  declaration: string,
  subject: RDF.NamedNode,
  predicate: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  //The expression is a constraint by a shape
  // Thus we get the shape and make a star shape sub KG
  const shape = availableShapes.get(declaration);
  if (shape === undefined) {
    return error(`shape ${declaration} is not an available shape`);
  }
  const subSubject = DF.namedNode(shape.id);
  const respSubKg = shape_to_kg_subject(shape, subSubject, availableShapes);
  if (isError(respSubKg)) {
    return respSubKg;
  }
  const triple = DF.quad(subject, predicate, subSubject);
  const kg: IKG = {
    statements: [triple],
    unionStatement: [],
    constraints: new Map(),
  };
  mergeKg(kg, respSubKg.value);

  return result(kg);
}

function handleShapeAnd(
  shape: ShapeAnd,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode,
): Result<IKG, string> {
  return handleShapeOrAnd(mergeKg, shape, subject, availableShapes, predicate);
}

function handleShapeOr(
  shape: ShapeOr,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode,
): Result<IKG, string> {
  return handleShapeOrAnd(mergeUnionKg, shape, subject, availableShapes, predicate);
}

function handleShapeOrAnd(
  mergeFunction: (mergeableKg: IKG, otherKg: IKG) => void,
  shape: ShapeOr | ShapeAnd,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode,
): Result<IKG, string> {
  const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraints: new Map(),
  };
  for (const expression of shape.shapeExprs) {
    if (typeof expression === 'string' && predicate !== undefined) {
      const resultKg = handleShapeDeclarationRef(expression, subject, predicate, availableShapes);
      if (isError(resultKg)) {
        return resultKg;
      }
      mergeFunction(kg, resultKg.value);
    } else if (typeof expression === 'string' && predicate === undefined) {
      return error('no predicate was defined for a union shape as a value expression');
    } else if (typeof expression !== 'string') {
      const otherKg = handleShapeExpression(expression, subject, availableShapes, predicate);
      mergeFunction(kg, otherKg);
    }
  }
  return result(kg);
}

function mergeKg(mergeableKg: IKG, otherKg: IKG): void {
  mergeableKg.statements = mergeableKg.statements.concat(otherKg.statements);
  mergeableKg.unionStatement = mergeableKg.unionStatement.concat(otherKg.unionStatement);
  mergeableKg.constraints = new Map([...mergeableKg.constraints, ...otherKg.constraints]);
}

function mergeUnionKg(mergeableKg: IKG, otherKg: IKG): void {
  mergeableKg.unionStatement.push(otherKg);
}

export interface IKG {
  statements: RDF.Quad[];
  unionStatement: IKG[];
  constraints: Map<string, IKGConstraint[]>;
}

export interface IKGConstraint {
  statement: RDF.Quad;
  kind: Kind;
  constraint: nodeKind | IRIREF | valueSetValue[];
}

export enum Kind {
  NODE_KIND,
  IRI_REF,
  DATA_TYPE,
  VALUE_SET,
}
