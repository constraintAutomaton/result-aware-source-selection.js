import * as RDF from '@rdfjs/types';
import type {
  Schema,
  TripleConstraint,
  Shape,
  ShapeDecl,
  ShapeOr,
  shapeExpr,
  ShapeAnd,
  EachOf,
  OneOf,
  tripleExprOrRef,
  NodeConstraint,
  nodeKind,
  IRIREF,
  valueSetValue,
} from 'shexj';
import { DataFactory } from 'rdf-data-factory';
import { error, isError, result, type Result } from 'result-interface';

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
  if (shape.shapeExpr === undefined) {
    return result({
      statements: [],
      unionStatement: [],
      constraints: new Map(),
    });
  }
  return handleShapeExpression(shape.shapeExpr, subject, availableShapes);
}

export function quadToString(quad: RDF.Quad): string {
  return `${quad.subject.value}-${quad.predicate.value}-${quad.object.value}`;
}

/**
 * Convert a node constraint into a knowledge graph.
 * It does not handle when a NodeConstraint has multiple constraint because it should not happen.
 * @param {NodeConstraint} node A node constraint.
 * @param {RDF.NamedNode} subject The subject of the triple.
 * @param {RDF.NamedNode} predicate The predicate of the triple.
 * @returns {IKG} - The resulting knowledge graph.
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
): Result<IKG, string> {
  switch (shape.type) {
    case 'NodeConstraint':
      if (predicate === undefined) {
        return result({ statements: [], unionStatement: [], constraints: new Map() });
      }
      return result(handleNodeConstraint(shape, subject, predicate));
    case 'Shape':
      return handleShape(shape, subject, availableShapes);
    case 'ShapeAnd':
      return handleShapeAnd(shape, subject, availableShapes, predicate);
    case 'ShapeOr':
      return handleShapeOr(shape, subject, availableShapes, predicate);
    case 'ShapeNot':
      return error('ShapeNot is not handled');
    case 'ShapeExternal':
      return error('ShapeExternal cannot be resolved');
  }
}

export function handleShape(
  shape: Shape,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraints: new Map(),
  };

  // we are ignoring extra for now

  // we are ignoring extend for now

  if (shape.expression !== undefined) {
    const res = handleTripleExprOrRef(shape.expression, subject, availableShapes);
    if (isError(res)) return res;
    mergeKg(kg, res.value);
  }

  return result(kg);
}

function handleTripleExprOrRef(
  expr: tripleExprOrRef,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  if (typeof expr === 'string') {
    return error(`tripleExprRef '${expr}' is not supported`);
  }
  return handleTripleExpr(expr, subject, availableShapes);
}

function handleTripleExpr(
  expr: EachOf | OneOf | TripleConstraint,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  switch (expr.type) {
    case 'TripleConstraint':
      return handleTripleConstraint(expr, subject, availableShapes);
    case 'EachOf':
      return handleEachOf(expr, subject, availableShapes);
    case 'OneOf':
      return handleOneOf(expr, subject, availableShapes);
  }
}

function handleTripleConstraint(
  expr: TripleConstraint,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  if (expr.inverse === true) {
    return error(`inverse TripleConstraints are not supported (predicate: ${expr.predicate})`);
  }
  const predicate = DF.namedNode(expr.predicate);

  if (expr.valueExpr === undefined) {
    return result({
      statements: [DF.quad(subject, predicate, DF.blankNode())],
      unionStatement: [],
      constraints: new Map(),
    });
  }
  if (typeof expr.valueExpr === 'string') {
    return handleShapeDeclarationRef(expr.valueExpr, subject, predicate, availableShapes);
  }
  const subSuject = DF.namedNode(`sub-${subject.value}`);
  return handleShapeExpression(expr.valueExpr, subSuject, availableShapes, predicate);
}

function handleEachOf(
  expr: EachOf,
  subject: RDF.NamedNode|RDF.BlankNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraints: new Map(),
  };
  for (const sub of expr.expressions) {
    const res = handleTripleExprOrRef(sub, subject, availableShapes);
    if (isError(res)) {
      return res;
    }
    mergeKg(kg, res.value);
  }
  return result(kg);
}

function handleOneOf(
  expr: OneOf,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
): Result<IKG, string> {
  const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraints: new Map(),
  };
  for (const sub of expr.expressions) {
    const res = handleTripleExprOrRef(sub, subject, availableShapes);
    if (isError(res)) return res;
    mergeUnionKg(kg, res.value);
  }
  return result(kg);
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

export function handleShapeAnd(
  shape: ShapeAnd,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode,
): Result<IKG, string> {
  return handleShapeOrAnd(shape, subject, availableShapes, predicate);
}

export function handleShapeOr(
  shape: ShapeOr,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode,
): Result<IKG, string> {
  return handleShapeOrAnd(shape, subject, availableShapes, predicate);
}

function handleShapeOrAnd(
  shape: ShapeOr | ShapeAnd,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode,
): Result<IKG, string> {
  const mergeFunction: (mergeableKg: IKG, otherKg: IKG) => void = isShapeOr(shape)
    ? mergeUnionKg
    : mergeKg;

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
      const refShape = availableShapes.get(expression);
      if (refShape === undefined) {
        return error(`shape ${expression} is not an available shape`);
      }
      const subKg = shape_to_kg_subject(refShape, DF.namedNode(refShape.id), availableShapes);
      if (isError(subKg)) return subKg;
      mergeFunction(kg, subKg.value);
    } else if (typeof expression !== 'string') {
      const res = handleShapeExpression(expression, subject, availableShapes, predicate);
      if (isError(res)) return res;
      mergeFunction(kg, res.value);
    }
  }
  return result(kg);
}

export function mergeKg(mergeableKg: IKG, otherKg: IKG): void {
  mergeableKg.statements = mergeableKg.statements.concat(otherKg.statements);
  mergeableKg.unionStatement = mergeableKg.unionStatement.concat(otherKg.unionStatement);
  for (const [key, constraint] of otherKg.constraints) {
    const mergeableKgConstraint = mergeableKg.constraints.get(key);
    if (mergeableKgConstraint) {
      mergeableKgConstraint.push(...constraint);
    } else {
      mergeableKg.constraints.set(key, constraint);
    }
  }
}

export function mergeUnionKg(mergeableKg: IKG, otherKg: IKG): void {
  mergeableKg.unionStatement.push(otherKg);
}

export interface IKG {
  statements: RDF.Quad[];
  unionStatement: IKG[];
  constraints: Map<string, IKGConstraint[]>;
}

export type IKGConstraint = {
  statement: RDF.Quad;
} & (
  | {
      kind: Kind.NODE_KIND;
      constraint: nodeKind;
    }
  | {
      kind: Kind.IRI_REF;
      constraint: IRIREF;
    }
  | {
      kind: Kind.DATA_TYPE;
      constraint: IRIREF;
    }
  | {
      kind: Kind.VALUE_SET;
      constraint: valueSetValue[];
    }
);

export enum Kind {
  NODE_KIND,
  IRI_REF,
  DATA_TYPE,
  VALUE_SET,
}

function isShapeOr(shape: ShapeOr | ShapeAnd): shape is ShapeOr {
  return shape.type === 'ShapeOr';
}
