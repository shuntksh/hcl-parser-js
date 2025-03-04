export const NodeTypes = {
	AdditiveOperator: "AdditiveOperator",
	Attribute: "Attribute",
	BinaryOperator: "BinaryOperator",
	Block: "Block",
	BooleanLiteral: "BooleanLiteral",
	CollectionValue: "CollectionValue",
	ComparisonOperator: "ComparisonOperator",
	ConditionalOperator: "ConditionalOperator",
	EqualityOperator: "EqualityOperator",
	Expression: "Expression",
	ForExpression: "ForExpression",
	ForObjectExpression: "ForObjectExpression",
	ForTupleExpression: "ForTupleExpression",
	FunctionCallExpression: "FunctionCallExpression",
	GetAttributeOperator: "GetAttributeOperator",
	HeredocTemplateExpression: "HeredocTemplateExpression",
	Identifier: "Identifier",
	IndexOperator: "IndexOperator",
	Label: "Label",
	LegacyIndexOperator: "LegacyIndexOperator",
	LogicalOperator: "LogicalOperator",
	MultiplicativeOperator: "MultiplicativeOperator",
	NullLiteral: "NullLiteral",
	NumberLiteral: "NumberLiteral",
	ObjectValue: "ObjectValue",
	ObjectValueElement: "ObjectValueElement",
	OneLineBlock: "OneLineBlock",
	QuotedTemplateContent: "QuotedTemplateContent",
	QuotedTemplateExpression: "QuotedTemplateExpression",
	SplatOperator: "SplatOperator",
	StringLiteral: "StringLiteral",
	Template: "Template",
	TemplateDirective: "TemplateDirective",
	TemplateExpression: "TemplateExpression",
	TemplateFor: "TemplateFor",
	TemplateIf: "TemplateIf",
	TemplateInterpolation: "TemplateInterpolation",
	TemplateLiteral: "TemplateLiteral",
	TupleValue: "TupleValue",
	UnaryOperator: "UnaryOperator",
	VariableExpression: "VariableExpression",
	ParenthesizedExpression: "ParenthesizedExpression",
} as const;

export type NodeType = (typeof NodeTypes)[keyof typeof NodeTypes];

export type ConfigFile = ConfigBody[];

export type ConfigBody = Attribute | Block | OneLineBlock;

export type Attribute = {
	type: typeof NodeTypes.Attribute;
	name: Identifier;
	value: Expression;
};

export type Block = {
	type: typeof NodeTypes.Block;
	blockType: Identifier;
	labels: Label[];
	bodies: ConfigBody[];
};

export type OneLineBlock = {
	type: typeof NodeTypes.OneLineBlock;
	blockType: Identifier;
	labels: Label[];
	attribute: Attribute | null;
};

export type Expression =
	| LiteralValue
	| CollectionValue
	| Operators
	| TemplateExpression
	| FunctionCallExpression
	| VariableExpression
	| ForExpression
	| IndexOperator
	| LegacyIndexOperator
	| GetAttributeOperator
	| SplatOperator
	| ParenthesizedExpression;

export type ParenthesizedExpression = {
	type: typeof NodeTypes.ParenthesizedExpression;
	expression: Expression;
};

export type Label = StringLiteral | Identifier;

export type Identifier = {
	type: typeof NodeTypes.Identifier;
	value: string;
};

export type StringLiteral = {
	type: typeof NodeTypes.StringLiteral;
	value: string;
};

export type LiteralValue = NumberLiteral | BooleanLiteral | NullLiteral;

export type NumberLiteral = {
	type: typeof NodeTypes.NumberLiteral;
	value: number;
};

export type BooleanLiteral = {
	type: typeof NodeTypes.BooleanLiteral;
	value: boolean;
};

export type NullLiteral = {
	type: typeof NodeTypes.NullLiteral;
	value: null;
};

export type CollectionValue = TupleValue | ObjectValue;

export type TupleValue = {
	type: typeof NodeTypes.TupleValue;
	elements: Expression[];
};

export type ObjectValue = {
	type: typeof NodeTypes.ObjectValue;
	elements: ObjectValueElement[];
};

export type ObjectValueElement = {
	key: Identifier;
	value: Expression;
};

export type TemplateExpression =
	| QuotedTemplateExpression
	| HeredocTemplateExpression;

export type QuotedTemplateExpression = {
	type: typeof NodeTypes.QuotedTemplateExpression;
	parts: QuotedTemplateContent[];
};

export type QuotedTemplateContent =
	| {
			type: typeof NodeTypes.TemplateLiteral;
			value: string;
	  }
	| TemplateInterpolation
	| TemplateDirective;

export type HeredocTemplateExpression = {
	type: typeof NodeTypes.HeredocTemplateExpression;
	marker: Identifier;
	stripIndent: boolean;
	template: Template[];
};

export type Template =
	| TemplateLiteral
	| TemplateInterpolation
	| TemplateDirective;

export type TemplateLiteral = {
	type: typeof NodeTypes.TemplateLiteral;
	value: string;
};

export type TemplateInterpolation = {
	type: typeof NodeTypes.TemplateInterpolation;
	expression: Expression;
	strip: {
		left: boolean;
		right: boolean;
	};
};

export type TemplateDirective = TemplateIf | TemplateFor;

export type TemplateIf = {
	type: typeof NodeTypes.TemplateIf;
	condition: Expression;
	then: Template;
	else: Template | null;
	strip: {
		if: { start: boolean; end: boolean };
		else: { start: boolean; end: boolean };
		endif: { start: boolean; end: boolean };
	};
};

export type TemplateFor = {
	type: typeof NodeTypes.TemplateFor;
	key: Identifier;
	value: Identifier | null;
	collection: Expression;
	template: Template;
	body: Template;
	strip: {
		for: { start: boolean; end: boolean };
		endfor: { start: boolean; end: boolean };
	};
};

export type FunctionCallExpression = {
	type: typeof NodeTypes.FunctionCallExpression;
	name: Identifier;
	args: Expression[];
};

export type VariableExpression = {
	type: typeof NodeTypes.VariableExpression;
	name: Identifier;
};

export const ForKinds = {
	Tuple: "tuple",
	Object: "object",
} as const;

export type ForKind = (typeof ForKinds)[keyof typeof ForKinds];

export type ForExpression = ForTupleExpression | ForObjectExpression;

export type ForIntro = {
	iterator: Identifier;
	value: Identifier | null;
	collection: Expression;
};

export type ForTupleExpression = {
	type: typeof NodeTypes.ForExpression;
	kind: typeof ForKinds.Tuple;
	intro: ForIntro;
	expression: Expression;
	condition: Expression | null;
};

export type ForObjectExpression = {
	type: typeof NodeTypes.ForExpression;
	kind: typeof ForKinds.Object;
	intro: ForIntro;
	key: Expression;
	value: Expression;
	grouping: boolean;
	condition: Expression | null;
};

export type IndexOperator = {
	type: typeof NodeTypes.IndexOperator;
	key: Expression;
	target: Expression;
};

export type LegacyIndexOperator = {
	type: typeof NodeTypes.LegacyIndexOperator;
	key: NumberLiteral;
	target: Expression;
};

export type GetAttributeOperator = {
	type: typeof NodeTypes.GetAttributeOperator;
	key: Identifier;
	target: Expression;
};

export type SplatOperator = AttrSplatOperator | FullSplatOperator;

export const SplatKinds = {
	Attribute: "Attribute",
	Full: "Full",
} as const;

export type SplatKind = (typeof SplatKinds)[keyof typeof SplatKinds];

export type SplatGetAttributeOperator = Omit<GetAttributeOperator, "target">;

export type AttrSplatOperator = {
	type: typeof NodeTypes.SplatOperator;
	kind: typeof SplatKinds.Attribute;
	attributes: SplatGetAttributeOperator[];
	target: Expression;
};

export type FullSplatOperator = {
	type: typeof NodeTypes.SplatOperator;
	kind: typeof SplatKinds.Full;
	operations: (SplatGetAttributeOperator | IndexOperator)[];
	target: Expression;
};

export type Operators = ConditionalOperator | UnaryOperator | BinaryOperator;

export type ConditionalOperator = {
	type: typeof NodeTypes.ConditionalOperator;
	predicate: Expression;
	trueExpr: Expression;
	falseExpr: Expression;
};

export const OperatorTypes = {
	Exclamation: "!",
	Minus: "-",
	Star: "*",
	Slash: "/",
	Percent: "%",
	Plus: "+",
	NotEqual: "!=",
	Equal: "==",
	GreaterThan: ">",
	GreaterThanOrEqual: ">=",
	LessThan: "<",
	LessThanOrEqual: "<=",
	And: "&&",
	Or: "||",
} as const;

export type UnaryOperator = {
	type: typeof NodeTypes.UnaryOperator;
	operator: typeof OperatorTypes.Exclamation | typeof OperatorTypes.Minus;
	term: Expression;
};

export type BinaryOperator =
	| MultiplicativeOperator
	| AdditiveOperator
	| ComparisonOperator
	| EqualityOperator
	| LogicalOperator;

export type MultiplicativeOperator = {
	type: typeof NodeTypes.BinaryOperator;
	operator:
		| typeof OperatorTypes.Star
		| typeof OperatorTypes.Slash
		| typeof OperatorTypes.Percent;
	left: Expression;
	right: Expression;
};

export type AdditiveOperator = {
	type: typeof NodeTypes.BinaryOperator;
	operator: typeof OperatorTypes.Plus | typeof OperatorTypes.Minus;
	left: Expression;
	right: Expression;
};

export type ComparisonOperator = {
	type: typeof NodeTypes.BinaryOperator;
	operator:
		| typeof OperatorTypes.NotEqual
		| typeof OperatorTypes.GreaterThan
		| typeof OperatorTypes.GreaterThanOrEqual
		| typeof OperatorTypes.LessThan
		| typeof OperatorTypes.LessThanOrEqual;
	left: Expression;
	right: Expression;
};

export type EqualityOperator = {
	type: typeof NodeTypes.BinaryOperator;
	operator: typeof OperatorTypes.Equal | typeof OperatorTypes.NotEqual;
	left: Expression;
	right: Expression;
};

export type LogicalOperator = {
	type: typeof NodeTypes.BinaryOperator;
	operator: typeof OperatorTypes.And | typeof OperatorTypes.Or;
	left: Expression;
	right: Expression;
};
