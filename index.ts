import { Algebra, Factory as OperationFactory, Util } from "sparqlalgebrajs";
import { type Result, result, error } from "result-interface";
import type * as RDF from "@rdfjs/types";
import type { Schema } from "shexj";
const deepEqual = require("fast-deep-equal/es6");

const AF = new OperationFactory();

export function resultAwareSourceSelection(
  Q: Algebra.Operation,
  F: IFederationMember[]
): Result<Algebra.Operation, String> {
  //AF.createUnion([recurResultAwareSourceSelection(Q, F)], true);

  if (Q.type !== Algebra.types.PROJECT) {
    return error("only support SELECT queries");
  }
  const QBgpConvertedIntoJoin = Util.mapOperation(
    Q,
    {
      bgp(op: Algebra.Bgp, factory: OperationFactory) {
        return {
          recurse: false,
          result: factory.createJoin(op.patterns),
        };
      },
    },
    AF
  );

  return result(
    recurResultAwareSourceSelection(
      QBgpConvertedIntoJoin,
      F,
      QBgpConvertedIntoJoin.variables
    )
  );
}

export function recurResultAwareSourceSelection(
  Q: Algebra.Operation,
  federation: IFederationMember[],
  variables: RDF.Variable[]
): Algebra.Operation {
  const plans: Algebra.Operation[] = [];

  if (Q.type === Algebra.types.PATTERN) {
    for (const federationMember of federation) {
      const clonedQ: Algebra.Pattern = <Algebra.Pattern>Util.cloneOperation(Q);
      const cloneQAssigned = assignFederationMemberToPattern(
        clonedQ,
        federationMember
      );
      const plan = cloneQAssigned;
      plans.push(plan);
    }
  }

  if (Q.type === Algebra.types.JOIN) {
    const nestedPlans: Algebra.Operation[] = [];
    for (const subQ of Q.input) {
      const plan = recurResultAwareSourceSelection(subQ, federation, variables);
      nestedPlans.push(plan);
    }
    const planCombinations = generateCombinations(nestedPlans);
    for (const combination of planCombinations) {
      const join = AF.createJoin(combination, true);
      plans.push(join);
    }
  }

  if (Q.type === Algebra.types.UNION) {
    for (const subQ of Q.input) {
      const plan = recurResultAwareSourceSelection(subQ, federation, variables);
      plans.push(plan);
    }
  }

  if(Q.type === Algebra.types.FILTER){
    const plan = recurResultAwareSourceSelection(Q.input, federation, variables);
    const filter = AF.createFilter(plan, Q.expression);
    plans.push(filter);
  }

  return selectPlan(plans);
}

function generateCombinations<T>(arr: T[]): [T, T][] {
  const result: [T, T][] = [];

  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      result.push([arr[i]!, arr[j]!]);
    }
  }

  return result;
}

export function selectPlan(plans: Algebra.Operation[]): Algebra.Operation {
  throw new Error("not implemented");
}

export function evaluatePlanShape(plan:Algebra.Operation, federation: IFederationMember[]):boolean{
  return true
}

export interface IFederationMember {
  url: string;
  summary: Schema;
}

export function assignFederationMemberToPattern(
  operation: Algebra.Pattern,
  f: IFederationMember
): Algebra.Pattern {
  operation.metadata = operation.metadata ? operation.metadata : {};
  operation.metadata.federationMember = f;
  return operation;
}
