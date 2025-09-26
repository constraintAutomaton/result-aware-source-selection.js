import * as RDF from "@rdfjs/types";
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
} from "shexj";
import { Visitor } from "@shexjs/visitor";
import { DataFactory } from "rdf-data-factory";
import {
  error,
  isError,
  isResult,
  result,
  type Result,
} from "result-interface";

const DF = new DataFactory<RDF.Quad>();

export function shex_to_kg(schema: Schema): RDF.Quad[] {
  const visitor = Visitor();
  const kg: RDF.Quad[] = [];

  return Array.from(new Set(kg));
}

export function shape_to_kg(
  shape: ShapeDecl,
  availableShapes: Map<string, ShapeDecl>
): Result<IKG, string> {
  const subject = DF.namedNode(shape.id);
  const kg = shape_to_kg_subject(shape, subject, availableShapes);
  return kg;
}
/**
 * Does not support NOT shapes and assume that the shape is closed
 * @param shape
 * @param subject
 * @param availableShapes
 * @returns
 */
function shape_to_kg_subject(
  shape: ShapeDecl,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>
): Result<IKG, string> {
  const visitor = Visitor();
  const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraint: new Map(),
  };

  visitor.visitTripleConstraint = tripleConstriantToKg(
    kg,
    subject,
    availableShapes
  );
  visitor.visitShapeDecl(shape);
  return result(kg);
}

function tripleConstriantToKg(
  kg: IKG,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>
): (el: any) => void {
  return (el) => {
    const constraint = <TripleConstraint>el;
    const predicate = DF.namedNode(constraint.predicate);
    const expression = constraint.valueExpr;
    // the case where constraint is not
    // TODO!! we are going to store the constraint in an object later
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

function handleNodeConstraint(node: NodeConstraint,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode){

}
function handleShapeExpression(
  shape: shapeExpr,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode
): IKG {
  return {
    statements: [],
    unionStatement: [],
    constraint: new Map(),
  };
}

function handleShapeDeclarationRef(
  declaration: string,
  subject: RDF.NamedNode,
  predicate: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>
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
    constraint: new Map(),
  };
  mergeKg(kg, respSubKg.value);

  return result(kg);
}

function handleShapeAnd(
  shape: ShapeAnd,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode
): Result<IKG, string> {
  return handleShapeOrAnd(mergeKg, shape, subject, availableShapes, predicate);
}

function handleShapeOr(
  shape: ShapeOr,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode
): Result<IKG, string> {
  return handleShapeOrAnd(mergeUnionKg, shape, subject, availableShapes, predicate);
}

function handleShapeOrAnd(mergeFunction: (mergeableKg:IKG, otherKg:IKG)=> void, shape: ShapeOr|ShapeAnd,
  subject: RDF.NamedNode,
  availableShapes: Map<string, ShapeDecl>,
  predicate?: RDF.NamedNode): Result<IKG, string>{
    const kg: IKG = {
    statements: [],
    unionStatement: [],
    constraint: new Map(),
  };
  for (const expression of shape.shapeExprs) {
    if (typeof expression === "string" && predicate !== undefined) {
      const resultKg = handleShapeDeclarationRef(
        expression,
        subject,
        predicate,
        availableShapes
      );
      if (isError(resultKg)) {
        return resultKg;
      }
      mergeFunction(kg, resultKg.value);
    } else if (typeof expression === "string" && predicate === undefined) {
      return error(
        "no predicate was defined for a union shape as a value expression"
      );
    } else if (typeof expression !== "string") {
      const otherKg = handleShapeExpression(expression, subject, availableShapes, predicate);
      mergeFunction(kg, otherKg);
    }
  }
  return result(kg);

  }
function mergeKg(mergeableKg: IKG, otherKg: IKG): void {
  mergeableKg.statements = mergeableKg.statements.concat(otherKg.statements);
  mergeableKg.unionStatement = mergeableKg.unionStatement.concat(
    otherKg.unionStatement
  );
  mergeableKg.constraint = new Map([
    ...mergeableKg.constraint,
    ...otherKg.constraint,
  ]);
}

function mergeUnionKg(mergeableKg: IKG, otherKg: IKG): void {
  mergeableKg.unionStatement.push(otherKg);
}

export interface IKG {
  statements: RDF.Quad[];
  unionStatement: IKG[];
  constraint: Map<string, IKGConstraint>;
}

export interface IKGConstraint {
  statement: RDF.Quad[];
  constraint: nodeKind|IRIREF|valueSetValue[];
}
