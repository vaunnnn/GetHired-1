import { readFileSync, writeFileSync } from "node:fs";
const path = "docs/backend-b1-openapi.json";
const spec = JSON.parse(readFileSync(path, "utf8"));
spec.info.title = "GetHired browser API";
if (!spec.info.description.includes("B6 category/question-bank")) spec.info.description += " B6 category/question-bank operations are included below; see backend-b6-question-bank.md. Earlier B1 documentation of future business work is historical.";
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const str = (minLength, maxLength) => ({ type: "string", minLength, maxLength });
const status = { type: "string", enum: ["active", "inactive"] };
const types = ["Introduction", "Technical", "Behavioral", "Situational", "Motivational", "Coding", "Design Challenge", "Candidate Questions"];
const phase = { type: "object", additionalProperties: false, required: ["id", "label", "shortLabel", "types", "count"], properties: {
  id: { ...str(1,40), pattern: "^[a-z][a-z-]*$" }, label: str(1,80), shortLabel: str(1,80), count: { type: "integer", minimum: 1, maximum: 5 }, types: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", enum: types } },
} };
const category = { name: str(1,120), description: str(0,2000), color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, bg: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, status, phases: { type: "array", minItems: 1, maxItems: 8, items: ref("B6Phase") } };
const question = { question: str(1,12000), type: { type: "string", enum: types }, hint: str(0,4000), feedback: { ...str(0,12000), description: "Private evaluation criteria: required for active written questions, empty for MCQs. MCQ explanations are prohibited." }, status, responseDefinition: ref("QuestionResponseDefinition") };
const id = { type: "string", format: "uuid" };
const object = (properties, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, properties, required });
Object.assign(spec.components.schemas, {
  QuestionOption: object({ id: { ...str(1,40), pattern: "^[a-z][a-z0-9_-]{0,39}$" }, text: str(1,1000) }),
  QuestionResponseDefinition: {
    description: "Single-correct-answer MCQs are allowed only for Technical, Situational, and Coding. Written is the default on create. Replace this complete object on PATCH; option IDs and trimmed case-insensitive labels must be unique.",
    oneOf: [object({ format: { type: "string", enum: ["written"] } }), object({
      format: { type: "string", enum: ["multiple_choice"] },
      options: { type: "array", minItems: 2, maxItems: 6, items: ref("QuestionOption") },
      correctOptionId: { ...str(1,40), description: "Must identify exactly one listed option. Admin/evaluator only." },
    })],
  },
  PublicQuestionResponseDefinition: { oneOf: [object({ format: { type: "string", enum: ["written"] } }), object({
    format: { type: "string", enum: ["multiple_choice"] }, options: { type: "array", minItems: 2, maxItems: 6, items: ref("QuestionOption") },
  })] },
  B6Phase: phase,
  B6Category: object({ ...category, id, pipeline: { type: "string" } }),
  B6Question: object({ ...question, id }),
  B6CategoryInput: object(category, ["name", "description", "color", "bg"]),
  B6CategoryPatch: { ...object(category, []), minProperties: 1 },
  B6QuestionInput: object(question, ["question", "type", "hint", "feedback"]),
  B6QuestionPatch: { ...object(question, []), minProperties: 1 },
  B6SelectedPhase: object({ id: str(1,40), label: str(1,80), shortLabel: str(1,80), questions: { type: "array", minItems: 1, maxItems: 5, items: object({ id, question: question.question, type: question.type, hint: question.hint, responseDefinition: ref("PublicQuestionResponseDefinition") }) } }),
});
const operations = [
  ["/categories", "get", "B6Category", false, true],
  ["/admin/categories", "get", "B6Category", true, true],
  ["/admin/categories", "post", "B6Category", true, false, "B6CategoryInput"],
  ["/admin/categories/{id}", "patch", "B6Category", true, false, "B6CategoryPatch"],
  ["/admin/categories/{id}/questions", "get", "B6Question", true, true],
  ["/admin/categories/{id}/questions", "post", "B6Question", true, false, "B6QuestionInput"],
  ["/admin/questions/{id}", "patch", "B6Question", true, false, "B6QuestionPatch"],
  ["/categories/{id}/pipeline", "get", "B6SelectedPhase", false, false],
];
for (const [path, method, schema, admin, list, input] of operations) {
  const parameters = [];
  if (path.includes("{id}")) parameters.push({ in: "path", name: "id", required: true, schema: id });
  if (list) {
    parameters.push({ in: "query", name: "page", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } }, { in: "query", name: "pageSize", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } });
    if (admin) parameters.push({ in: "query", name: "status", schema: status });
  }
  if (input) parameters.push({ in: "header", name: "X-CSRF-Token", required: true, schema: { type: "string" } });
  const data = list || schema === "B6SelectedPhase" ? { type: "array", items: ref(schema) } : ref(schema);
  const response = object({ data, requestId: id, ...(list ? { meta: object({ page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" } }) } : {}) });
  const op = { tags: ["B6"], security: [{ accessCookie: [] }], description: `${admin ? "Requires questions:write (admin)." : "Requires categories:read (student/admin)."} Session cookies required. ${schema === "B6SelectedPhase" ? "Random server selection; no rubrics. Insufficient content returns 409 CATEGORY_UNAVAILABLE. Not a persisted attempt." : "See B6 contract for validation and pipeline defaults."}`, parameters,
    responses: { [method === "post" ? "201" : "200"]: { description: "Success", content: { "application/json": { schema: response } } }, ...Object.fromEntries([400,401,403,404,405,409,413,415,503].map(code => [code, { $ref: "#/components/responses/ApiError" }])) },
  };
  if (input) op.requestBody = { required: true, content: { "application/json": { schema: ref(input) } } };
  (spec.paths[path] ??= {})[method] = op;
}
writeFileSync(path, JSON.stringify(spec, null, 2) + "\n");
const collectionPath = "docs/GetHired.postman_collection.json";
const collection = JSON.parse(readFileSync(collectionPath, "utf8").replace(/^\uFEFF/, ""));
collection.item = collection.item.filter(item => item.name !== "B6 question bank");
collection.item.push({ name: "B6 question bank", description: "Use the existing login and CSRF flow first. Admin requests need an admin session. Set categoryId/questionId from created resources. Run mutations only against a test database.", item: operations.map(([path, method, schema, admin, list, input]) => ({
  name: `${method.toUpperCase()} ${path}`,
  request: { method: method.toUpperCase(), header: [{ key: "Accept", value: "application/json" }, ...(input ? [{ key: "Content-Type", value: "application/json" }, { key: "X-CSRF-Token", value: "{{csrfToken}}" }, { key: "Origin", value: "{{origin}}" }] : [])], url: `{{baseUrl}}${path.replace("{id}", path.startsWith("/admin/questions") ? "{{questionId}}" : "{{categoryId}}")}`, ...(input ? { body: { mode: "raw", raw: JSON.stringify(method === "patch" ? { status: "active" } : schema === "B6Category" ? { name: "B6 test", description: "Test category", color: "#112233", bg: "#ffffff", phases: [{ id: "intro", label: "Introduction", shortLabel: "Intro", types: ["Introduction"], count: 1 }] } : { question: "Introduce yourself", type: "Introduction", hint: "Be specific", feedback: "Private test rubric" }, null, 2) } } : {}) },
  event: [{ listen: "test", script: { type: "text/javascript", exec: [
    `pm.test('Expected success status', () => pm.response.to.have.status(${method === "post" ? 201 : 200}));`,
    "const body = pm.response.json();",
    "pm.test('Envelope has request ID and data', () => { pm.expect(body.requestId).to.be.a('string'); pm.expect(body).to.have.property('data'); });",
    ...(!admin ? ["pm.test('No private rubric or answer key fields', () => pm.expect(JSON.stringify(body)).not.to.match(/\"(feedback|correctOptionId)\"\\s*:/));"] : []),
    ...(method === "post" ? [`if (pm.response.code === 201) pm.collectionVariables.set('${schema === "B6Category" ? "categoryId" : "questionId"}', body.data.id);`] : []),
  ] } }],
})) });
writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + "\n");
