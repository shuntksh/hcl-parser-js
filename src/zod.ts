import { z } from "zod";
import type * as Types from "./types";
import { ForKinds, NodeTypes, OperatorTypes, SplatKinds } from "./types";

// Type check helper to ensure the schema matches the type
type SchemaTypeOf<T> = z.ZodType<T>;

/**
 * The root zod schema for the HCL parser output.
 * example:
 * const ast = parse(template);
 * const result = schema.parse(ast);
 */
export const schema = z.lazy(() =>
	z.array(bodySchema),
) satisfies SchemaTypeOf<Types.ConfigFile>;

export const expressionSchema: z.ZodType<Types.Expression> = z.lazy(() =>
	z.union([
		literalValueSchema,
		collectionValueSchema,
		operatorsSchema,
		templateExpressionSchema,
		functionCallExpressionSchema,
		variableExpressionSchema,
		forExpressionSchema,
		indexOperatorSchema,
		legacyIndexOperatorSchema,
		getAttributeOperatorSchema,
		splatOperatorSchema,
		parenthesizedExpressionSchema,
	]),
) satisfies SchemaTypeOf<Types.Expression>;

export const parenthesizedExpressionSchema = z.object({
	type: z.literal(NodeTypes.ParenthesizedExpression),
	expression: expressionSchema,
}) satisfies SchemaTypeOf<Types.ParenthesizedExpression>;

export const identifierSchema = z.object({
	type: z.literal(NodeTypes.Identifier),
	value: z.string(),
}) satisfies SchemaTypeOf<Types.Identifier>;

export const labelSchema = z.lazy(() =>
	z.union([identifierSchema, stringLiteralSchema]),
);

export const attributeSchema = z.object({
	type: z.literal(NodeTypes.Attribute),
	name: identifierSchema,
	value: expressionSchema,
}) satisfies SchemaTypeOf<Types.Attribute>;

export const blockSchema: z.ZodType = z.object({
	type: z.literal(NodeTypes.Block),
	blockType: identifierSchema,
	labels: z.array(labelSchema),
	bodies: z.array(z.lazy(() => bodySchema)),
}) satisfies SchemaTypeOf<Types.Block>;

export const oneLineBlockSchema = z.object({
	type: z.literal(NodeTypes.OneLineBlock),
	blockType: identifierSchema,
	labels: z.array(labelSchema),
	attribute: attributeSchema.nullable(),
}) satisfies SchemaTypeOf<Types.OneLineBlock>;

export const bodySchema = z.union([
	attributeSchema,
	blockSchema,
	oneLineBlockSchema,
]) satisfies SchemaTypeOf<Types.ConfigBody>;

export const stringLiteralSchema = z.object({
	type: z.literal(NodeTypes.StringLiteral),
	value: z.string(),
}) satisfies SchemaTypeOf<Types.StringLiteral>;

export const numberLiteralSchema = z.object({
	type: z.literal(NodeTypes.NumberLiteral),
	value: z.number(),
}) satisfies SchemaTypeOf<Types.NumberLiteral>;

export const booleanLiteralSchema = z.object({
	type: z.literal(NodeTypes.BooleanLiteral),
	value: z.boolean(),
}) satisfies SchemaTypeOf<Types.BooleanLiteral>;

export const nullLiteralSchema = z.object({
	type: z.literal(NodeTypes.NullLiteral),
	value: z.null(),
}) satisfies SchemaTypeOf<Types.NullLiteral>;

export const literalValueSchema = z.union([
	numberLiteralSchema,
	booleanLiteralSchema,
	nullLiteralSchema,
]);

export const tupleValueSchema = z.object({
	type: z.literal(NodeTypes.TupleValue),
	elements: z.array(expressionSchema),
}) satisfies SchemaTypeOf<Types.TupleValue>;

export const objectValueElementSchema = z.object({
	key: identifierSchema,
	value: expressionSchema,
}) satisfies SchemaTypeOf<Types.ObjectValueElement>;

export const objectValueSchema = z.object({
	type: z.literal(NodeTypes.ObjectValue),
	elements: z.array(objectValueElementSchema),
}) satisfies SchemaTypeOf<Types.ObjectValue>;

export const collectionValueSchema = z.union([
	tupleValueSchema,
	objectValueSchema,
]);

export const quotedTemplateContentSchema = z.lazy(() =>
	z.union([
		templateLiteralSchema,
		templateInterpolationSchema,
		templateDirectiveSchema,
	]),
);

export const quotedTemplateExpressionSchema = z.object({
	type: z.literal(NodeTypes.QuotedTemplateExpression),
	parts: z.array(quotedTemplateContentSchema),
}) satisfies SchemaTypeOf<Types.QuotedTemplateExpression>;

export const templateLiteralSchema: z.ZodType = z.object({
	type: z.literal(NodeTypes.TemplateLiteral),
	value: z.string(),
}) satisfies SchemaTypeOf<Types.TemplateLiteral>;

export const templateInterpolationSchema = z.object({
	type: z.literal(NodeTypes.TemplateInterpolation),
	expression: z.lazy(() => expressionSchema),
	strip: z.object({
		left: z.boolean(),
		right: z.boolean(),
	}),
}) satisfies SchemaTypeOf<Types.TemplateInterpolation>;

export const templateSchema: z.ZodType<Types.Template> = z.lazy(() =>
	z.union([
		templateLiteralSchema,
		templateInterpolationSchema,
		templateDirectiveSchema,
	]),
);

export const templateIfSchema: z.ZodType<Types.TemplateIf> = z.object({
	type: z.literal(NodeTypes.TemplateIf),
	condition: expressionSchema,
	then: templateSchema,
	else: templateSchema.nullable(),
	strip: z.object({
		if: z.object({ start: z.boolean(), end: z.boolean() }),
		else: z.object({ start: z.boolean(), end: z.boolean() }),
		endif: z.object({ start: z.boolean(), end: z.boolean() }),
	}),
});

export const templateForSchema = z.object({
	type: z.literal(NodeTypes.TemplateFor),
	key: identifierSchema,
	value: identifierSchema.nullable(),
	collection: expressionSchema,
	template: z.lazy(() => templateSchema),
	body: z.lazy(() => templateSchema),
	strip: z.object({
		for: z.object({ start: z.boolean(), end: z.boolean() }),
		endfor: z.object({ start: z.boolean(), end: z.boolean() }),
	}),
}) satisfies SchemaTypeOf<Types.TemplateFor>;

export const templateDirectiveSchema = z.union([
	templateIfSchema,
	templateForSchema,
]);

export const heredocTemplateExpressionSchema = z.object({
	type: z.literal(NodeTypes.HeredocTemplateExpression),
	marker: identifierSchema,
	stripIndent: z.boolean(),
	template: z.array(templateSchema),
}) satisfies SchemaTypeOf<Types.HeredocTemplateExpression>;

export const templateExpressionSchema = z.union([
	quotedTemplateExpressionSchema,
	heredocTemplateExpressionSchema,
]) satisfies SchemaTypeOf<Types.TemplateExpression>;

export const functionCallExpressionSchema = z.object({
	type: z.literal(NodeTypes.FunctionCallExpression),
	name: identifierSchema,
	args: z.array(z.lazy(() => expressionSchema)),
}) satisfies SchemaTypeOf<Types.FunctionCallExpression>;

export const variableExpressionSchema = z.object({
	type: z.literal(NodeTypes.VariableExpression),
	name: identifierSchema,
}) satisfies SchemaTypeOf<Types.VariableExpression>;

export const forIntroSchema = z.object({
	iterator: identifierSchema,
	value: identifierSchema.nullable(),
	collection: z.lazy(() => expressionSchema),
}) satisfies SchemaTypeOf<Types.ForIntro>;

export const forTupleExpressionSchema = z.object({
	type: z.literal(NodeTypes.ForExpression),
	kind: z.literal(ForKinds.Tuple),
	intro: forIntroSchema,
	expression: z.lazy(() => expressionSchema),
	condition: z.lazy(() => expressionSchema).nullable(),
}) satisfies SchemaTypeOf<Types.ForTupleExpression>;

export const forObjectExpressionSchema = z.object({
	type: z.literal(NodeTypes.ForExpression),
	kind: z.literal(ForKinds.Object),
	intro: forIntroSchema,
	key: z.lazy(() => expressionSchema),
	value: z.lazy(() => expressionSchema),
	grouping: z.boolean(),
	condition: z.lazy(() => expressionSchema).nullable(),
}) satisfies SchemaTypeOf<Types.ForObjectExpression>;

export const forExpressionSchema = z.union([
	forTupleExpressionSchema,
	forObjectExpressionSchema,
]) satisfies SchemaTypeOf<Types.ForExpression>;

export const indexOperatorSchema = z.object({
	type: z.literal(NodeTypes.IndexOperator),
	key: expressionSchema,
	target: expressionSchema,
}) satisfies SchemaTypeOf<Types.IndexOperator>;

export const legacyIndexOperatorSchema = z.object({
	type: z.literal(NodeTypes.LegacyIndexOperator),
	key: numberLiteralSchema,
	target: expressionSchema,
}) satisfies SchemaTypeOf<Types.LegacyIndexOperator>;

export const getAttributeOperatorSchema = z.object({
	type: z.literal(NodeTypes.GetAttributeOperator),
	key: identifierSchema,
	target: expressionSchema,
}) satisfies SchemaTypeOf<Types.GetAttributeOperator>;

export const splatGetAttributeOperatorSchema = z.object({
	type: z.literal(NodeTypes.GetAttributeOperator),
	key: identifierSchema,
}) satisfies SchemaTypeOf<Types.SplatGetAttributeOperator>;

export const attrSplatOperatorSchema = z.object({
	type: z.literal(NodeTypes.SplatOperator),
	kind: z.literal(SplatKinds.Attribute),
	attributes: z.array(splatGetAttributeOperatorSchema),
	target: expressionSchema,
}) satisfies SchemaTypeOf<Types.AttrSplatOperator>;

export const fullSplatOperatorSchema = z.object({
	type: z.literal(NodeTypes.SplatOperator),
	kind: z.literal(SplatKinds.Full),
	operations: z.array(
		z.union([splatGetAttributeOperatorSchema, indexOperatorSchema]),
	),
	target: expressionSchema,
}) satisfies SchemaTypeOf<Types.FullSplatOperator>;

export const splatOperatorSchema = z.union([
	attrSplatOperatorSchema,
	fullSplatOperatorSchema,
]);

export const conditionalOperatorSchema = z.object({
	type: z.literal(NodeTypes.ConditionalOperator),
	predicate: expressionSchema,
	trueExpr: expressionSchema,
	falseExpr: expressionSchema,
}) satisfies SchemaTypeOf<Types.ConditionalOperator>;

export const unaryOperatorSchema = z.object({
	type: z.literal(NodeTypes.UnaryOperator),
	operator: z.union([
		z.literal(OperatorTypes.Exclamation),
		z.literal(OperatorTypes.Minus),
	]),
	term: expressionSchema,
}) satisfies SchemaTypeOf<Types.UnaryOperator>;

export const multiplicativeOperatorSchema = z.object({
	type: z.literal(NodeTypes.BinaryOperator),
	operator: z.union([
		z.literal(OperatorTypes.Star),
		z.literal(OperatorTypes.Slash),
		z.literal(OperatorTypes.Percent),
	]),
	left: expressionSchema,
	right: expressionSchema,
}) satisfies SchemaTypeOf<Types.MultiplicativeOperator>;

export const additiveOperatorSchema = z.object({
	type: z.literal(NodeTypes.BinaryOperator),
	operator: z.union([
		z.literal(OperatorTypes.Plus),
		z.literal(OperatorTypes.Minus),
	]),
	left: expressionSchema,
	right: expressionSchema,
}) satisfies SchemaTypeOf<Types.AdditiveOperator>;

export const comparisonOperatorSchema = z.object({
	type: z.literal(NodeTypes.BinaryOperator),
	operator: z.union([
		z.literal(OperatorTypes.NotEqual),
		z.literal(OperatorTypes.GreaterThan),
		z.literal(OperatorTypes.GreaterThanOrEqual),
		z.literal(OperatorTypes.LessThan),
		z.literal(OperatorTypes.LessThanOrEqual),
	]),
	left: expressionSchema,
	right: expressionSchema,
}) satisfies SchemaTypeOf<Types.ComparisonOperator>;

export const equalityOperatorSchema = z.object({
	type: z.literal(NodeTypes.BinaryOperator),
	operator: z.union([
		z.literal(OperatorTypes.Equal),
		z.literal(OperatorTypes.NotEqual),
	]),
	left: expressionSchema,
	right: expressionSchema,
}) satisfies SchemaTypeOf<Types.EqualityOperator>;

export const logicalOperatorSchema = z.object({
	type: z.literal(NodeTypes.BinaryOperator),
	operator: z.union([
		z.literal(OperatorTypes.And),
		z.literal(OperatorTypes.Or),
	]),
	left: expressionSchema,
	right: expressionSchema,
}) satisfies SchemaTypeOf<Types.LogicalOperator>;

export const binaryOperatorSchema = z.union([
	multiplicativeOperatorSchema,
	additiveOperatorSchema,
	comparisonOperatorSchema,
	equalityOperatorSchema,
	logicalOperatorSchema,
]) satisfies SchemaTypeOf<Types.BinaryOperator>;

export const operatorsSchema = z.union([
	conditionalOperatorSchema,
	unaryOperatorSchema,
	binaryOperatorSchema,
]) satisfies SchemaTypeOf<Types.Operators>;
