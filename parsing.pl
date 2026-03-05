:- use_module(library(serialization/json)).



shex_("{\"type\":\"Schema\",\"shapes\":[{\"id\":\"http://ex.example/#IssueShape\",\"type\":\"ShapeDecl\",\"shapeExpr\":{\"type\":\"Shape\",\"expression\":{\"type\":\"EachOf\",\"expressions\":[{\"type\":\"TripleConstraint\",\"predicate\":\"http://ex.example/#state\",\"valueExpr\":{\"type\":\"NodeConstraint\",\"values\":[\"http://ex.example/#unassigned\",\"http://ex.example/#assigned\"]}},{\"type\":\"TripleConstraint\",\"predicate\":\"http://ex.example/#reportedBy\",\"valueExpr\":{\"type\":\"Shape\",\"expression\":{\"type\":\"EachOf\",\"expressions\":[{\"type\":\"TripleConstraint\",\"predicate\":\"http://xmlns.com/foaf/0.1/name\",\"valueExpr\":{\"type\":\"NodeConstraint\",\"nodeKind\":\"literal\"}},{\"type\":\"TripleConstraint\",\"predicate\":\"http://xmlns.com/foaf/0.1/mbox\",\"valueExpr\":{\"type\":\"NodeConstraint\",\"nodeKind\":\"iri\"},\"min\":1,\"max\":-1}]}}}]}}}]}").
