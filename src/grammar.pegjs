/**
 * HCL (HashiCorp Configuration Language) Native Grammar in Peggy (formally known as PEG.js)
 *
 * This grammar is based on the HCL native specification and the HCL spec and manually
 * written to be more readable and easier to understand.
 *
 * Usage:
 * 1. Use peggy to generate the parser from this grammar.
 * 2. Use the parser to parse the HCL configuration.
 * 3. Use the parsed configuration to generate the HCL code.
 *
 * References:
 * - @see https://peggyjs.org/ for more information on Peggy
 * - @see https://peggyjs.org/documentation.html#grammar-syntax-and-semantics for syntax
 * - @see doc/native.md for the HCL native specification
 * - @see doc/spec.md for the human readable HCL specification
 */

//
// Global Scope ----------------------------------------------------------------
//
{
	// Used to match the closing marker of a heredoc
	let heredocMarker = null;

	// Node types
	const NodeTypes = {
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
	} 

	const ForKinds = {
		Tuple: "tuple",
		Object: "object",
	}

	const SplatKinds = {
		Attribute: "Attribute",
		Full: "Full",
	}
}

//
// Structural Elements ---------------------------------------------------------
//

/**
 * Entrypoint: ConfigFile represents the top-level HCL configuration structure
 */
ConfigFile
  = __ bodies:Bodies __ { return bodies }

/**
 * Body consists of a sequence of attributes and blocks
 */
Bodies
  = __ items:(__ item:BodyElement __ { return item })*
	{ return items }

BodyElement
  = Attribute
  / Block
  / OneLineBlock

/**
 * Attribute assigns a value to a name
 * Attribute = Identifier "=" Expression
 */
Attribute
  = _ name:Identifier _ "=" _ value:Expression _ _terminator
	{	return { type: NodeTypes.Attribute, name: name, value: value } }

/**
 * OneLineBlock is a simplified block format for single attributes
 * OneLineBlock = Identifier labels { attribute }
 */
OneLineBlock
  = _ blockType:Identifier _ labels:(_labels)* _ "{" _ attr:(Identifier _ "=" _ Expression)? _ "}" _ _terminator
	{
		const attribute = attr ? { type: NodeTypes.Attribute, name: attr[0], value: attr[4] } : null
		return { type: NodeTypes.OneLineBlock, blockType, labels, attribute }
	}

/**
 * Block creates a child body with type and optional labels
 * Block = Identifier labels { \n bodies \n }
 */
Block
  = _ blockType:Identifier 
		_ labels:(_labels)* 
    _ "{" 
      __ bodies:Bodies?
    __ "}"
		_ _terminator
	{ return { type: NodeTypes.Block, blockType, labels, bodies } }

_labels = _ label:(StringLit / Identifier) { return label }
_terminator = NewLine / __eof

//
// Expression Sub-languages -----------------------------------------------------
//

// #1 Top-level expression starts with the lowest precedence (conditional)
Expression
  = head:BinaryOp tail:(_ "?" _ Expression _ ":" _ Expression)?
    { return tail ? { type: NodeTypes.ConditionalOperator, predicate: head, trueExpr: tail[3], falseExpr: tail[7]} : head }
  / UnaryOp
  / _expr_term

// #2 Unary/Binary Operators
UnaryOp
  = _ operator:("-" / "!") _ term:_expr_term 
    { return { type: NodeTypes.UnaryOperator, operator, term } }

BinaryOp
  = LogicalOrOp // to cascade binary operators based on precedence

LogicalOrOp // Level 1
  = left:LogicalAndOp right:(_ "||" _ Expression)?
    { return right ? { type: NodeTypes.BinaryOperator, operator: "||", left, right: right[3] } : left }

LogicalAndOp // Level 2
  = left:EqualityOp right:(_ "&&" _ Expression)?
    { return right ? { type: NodeTypes.BinaryOperator, operator: "&&", left, right: right[3] } : left }

EqualityOp // Level 3
  = left:ComparisonOp right:(_ operator:("==" / "!=") _ Expression)?
    { return right ? { type: NodeTypes.BinaryOperator, operator: right[1], left, right: right[3] } : left }

ComparisonOp // Level 4
  = left:AdditiveOp right:(_ operator:(">=" / "<=" / ">" / "<") _ Expression)?
    { return right ? { type: NodeTypes.BinaryOperator, operator: right[1], left, right: right[3] } : left }

AdditiveOp // Level 5
  = left:MultiplicativeOp right:(_ operator:("+" / "-") _ Expression)?
    { return right ? { type: NodeTypes.BinaryOperator, operator: right[1], left, right: right[3] } : left }

MultiplicativeOp // Level 6
  = left:_expr_term right:(_ operator:("*" / "/" / "%") _ Expression)?
    { return right ? { type: NodeTypes.BinaryOperator, operator: right[1], left, right: right[3] } : left }

// #3 Expression Terms handles the lowest precedence expressions
_expr_term
  = head:(
        TemplateExpr
      / LiteralValue
      / FunctionCall
      / CollectionValue
      / VariableExpr
      / ForExpr
      / "(" _ expression:Expression _ ")" { return { type: NodeTypes.ParenthesizedExpression, expression } }
      )
    tail:(Index / GetAttr / Splat)* 
    { return tail.reduce((target, op) => ({ ...op, target }), head) }

//
// Lexical Elements ------------------------------------------------------------
//

/**
 * Newline sequences (either U+000A or U+000D followed by U+000A)
 */
NewLine = "\n" / "\r\n" / LineComment 

/**
 * Line comments start with either the `//` or `#` sequences and end with
 * the next newline sequence. A line comment is considered equivalent to a
 * newline sequence.
 */
LineComment = "//"/"#" [^\n\r]* NewLine { return null }

/**
 * Inline comments start with the `/*` sequence and end with th	e `*''/`
 * sequence, and may have any characters within except the ending sequence.
 * An inline comment is considered equivalent to a whitespace sequence.
 */
InlineComment =  "/*" (!"*/" .)* "*/"

/**
 * Full Unicode identifier support following UAX #31 rules.
 * Note: This version is more complete but may impact performance.
 */
Identifier
  = first:_id_start rest:(_id_continue / "-")* {
      return {type: NodeTypes.Identifier, value: first + rest.join('')}
    }

_id_start
  = [a-zA-Z\u00A0-\uFFFF_] // TODO:Simplified Unicode letter range
  // = [a-zA-Z\u00A0-\uFFFF_\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}]

_id_continue
  = [a-zA-Z0-9\u00A0-\uFFFF_] // TODO: Simplified Unicode letter/number range
//  = [a-zA-Z0-9\u00A0-\uFFFF_\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}]

/**
 * Numeric literal represents a decimal number with optional fractional and exponent parts.
 * Examples: 123, 123.456, 123e10, 123.456e-10
 */
NumericLit "number"
  = integer:_decimal+ 
    fraction:("." _decimal+)? 
    exponent:(_expmark _decimal+)? {
      let str = integer.join('')
      if (fraction) str += '.' + fraction[1].join('')
      if (exponent) str += exponent[0] + exponent[1].join('')
      return {type: NodeTypes.NumberLiteral, value: parseFloat(str)}
    }
_decimal = [0-9]
_expmark = [eE] [+-]?

//
// Literal Expressions ---------------------------------------------------------
//

/**
 * StringLit represents a quoted string literal with escape sequences.
 * Does not allow raw newlines, only escaped ones (\n).
 */
StringLit
  = '"' chars:_char* '"' 
	{ return {type: NodeTypes.StringLiteral, value: chars.join('')} }

/**
 * LiteralValue = (NumericLit | "true" | "false" | "null");
 */
LiteralValue
  = NumericLit
  / TrueLit
  / FalseLit
  / NullLit

TrueLit = "true" { return { type: NodeTypes.BooleanLiteral, value: true } }
FalseLit = "false" { return { type: NodeTypes.BooleanLiteral, value: false } }
NullLit = "null" { return { type: NodeTypes.NullLiteral, value: null } }

//
// Collection Expressions ------------------------------------------------------
//

CollectionValue
  = _tuple
  / _object

// tuple = "[" ((Expression (("," | Newline) Expression)* ","?)?) "]";
_tuple
	= _ "["__ !"for" elements:Expression|.., _ ("," / NewLine) _ | __ "]" _
	{ return { type: NodeTypes.TupleValue, elements: elements.flat() } }

// object = "{" ((objectelem (( "," | Newline) objectelem)* ","?)?) "}";
// Return as a list of key-value pairs (objectelem)
// TODO: we need to check for duplicate keys
_object
  = _ "{" 
    __ !"for"
    elements:(_object_content)?
    __ "}" 
	{ return { type: NodeTypes.ObjectValue, elements: elements || [] } }

_object_content
  = first:_objectelem
    rest:(__ _objectelem)* 
	{ return [first, ...rest.map(r => r[1])] }

_objectelem
  = __ key:Identifier 
    _ ("=" / ":")
    _ value:Expression 
    (_ "," / NewLine / __) 
	{ return { key, value } }

//
// For Expressions -------------------------------------------------------------
//

/**
 * For Expressions
 * forTupleExpr = "[" _for_intro Expression _for_cond? "]";
 * forObjectExpr = "{" _for_intro Expression "=>" Expression "..."? _for_cond? "}";
 * _for_intro = "for" Identifier ("," Identifier)? "in" Expression ":";
 * _for_cond = "if" Expression;
 */
ForExpr
  = ForTupleExpr
  / ForObjectExpr

ForTupleExpr
  = "[" __ intro:_for_intro __ expression:Expression __ condition:_for_cond? __ "]" 
	{ return { type: NodeTypes.ForExpression, kind: ForKinds.Tuple, intro, expression, condition } }

ForObjectExpr
  = "{" __ intro:_for_intro __ key:Expression __ "=>" __ value:Expression 
    ellipsis:(_ "...")? __ condition:_for_cond? __ "}" 
	{ return { type: NodeTypes.ForExpression, kind: ForKinds.Object, intro, key, value, grouping: !!ellipsis, condition } }

_for_intro
  = "for" _ key:Identifier _ v:("," _ value:Identifier)? _ 
    "in" _ collection:Expression _ ":"
	{ return { iterator: key, value: v?.value || null, collection } }

_for_cond
  = "if" _ expr:Expression { return expr }

//
// Templates Expressions and Sub-languages -------------------------------------
//

/**
 * Template Expressions
 */
TemplateExpr
  = QuotedTemplate
  / HeredocTemplate

/**
 * Quoted template with interpolation support
 * Different from StringLit as it allows ${...} interpolation
 */
QuotedTemplate
  = '"' content:QuotedTemplateContent* '"' 
	{ return { type: NodeTypes.QuotedTemplateExpression, parts: content.flat() } }

QuotedTemplateContent
  = TemplateInterpolation
  / TemplateDirective
  / chars:_template_char+ 
	{ return { type: NodeTypes.TemplateLiteral, value: chars.join('') } }

/**
 * Heredoc template
 */
HeredocTemplate
  = _ "<<" indent:("-"/"") _ marker:_beginMarker _ NewLine
    	template:HeredocTemplateContent
    	_endMarker 
	{ return { type: NodeTypes.HeredocTemplateExpression, marker, stripIndent: indent === "-", template } }

// Ensure we match the beginning of the heredoc marker
_beginMarker = begin:Identifier { heredocMarker = begin.value; return begin;}

// & { predicate } is a positive assertion. No input is consumed.
_endMarker = NewLine? _ end:Identifier &{ return heredocMarker === end.value } _

HeredocTemplateContent
  = Template

Template 
  = parts:(TemplateLiteral / TemplateInterpolation / TemplateDirective)* {
    return parts.flat()
  }	

TemplateLiteral
  = chars:(!("${" / "%{" / _endMarker) .)+
	{ return { type: NodeTypes.TemplateLiteral, value: chars.map(c => c[1]).join('') } }

/**
 * TemplateInterpolation = ("${" | "${~") Expression ("}" | "~}");
 * Strip markers (~) remove adjacent whitespace
 */
TemplateInterpolation
  = "${" strip_left:"~"? 
    _ expression:Expression _ 
    strip_right:"~"? "}" 
	{ return { type: NodeTypes.TemplateInterpolation, expression, strip: { left: !!strip_left, right: !!strip_right } } }

/**
 * Template directives for conditional and iteration logic
 */
TemplateDirective 
  = TemplateIf
  / TemplateFor

/**
 * Template if directive with optional else clause
 * TemplateIf = (
 *   ("%{" | "%{~") "if" Expression ("}" | "~}")
 *   Template
 *   (("%{" | "%{~") "else" ("}" | "~}") Template)?
 *   ("%{" | "%{~") "endif" ("}" | "~}")
 * )
 */
TemplateIf
  = "%{" strip_start:"~"? _ "if" _ condition:Expression _ strip_end:"~"? "}"
    then_template:Template
    else_part:(
      "%{" strip_else_start:"~"? _ "else" _ strip_else_end:"~"? "}"
      else_template:Template
      { return { template: else_template, strip: { start: !!strip_else_start, end: !!strip_else_end } } }
    )?
    "%{" strip_endif_start:"~"? _ "endif" _ strip_endif_end:"~"? "}" {
    return {
      type: NodeTypes.TemplateIf,
      condition: condition,
      then: then_template,
      else: else_part?.template || null,
      strip: {
        if: { start: !!strip_start, end: !!strip_end },
        else: else_part?.strip || null,
        endif: { start: !!strip_endif_start, end: !!strip_endif_end }
      }
    }
  }

/**
 * Template for directive for iteration
 * TemplateFor = (
 *   ("%{" | "%{~") "for" Identifier ("," Identifier)? "in" Expression ("}" | "~}")
 *   Template
 *   ("%{" | "%{~") "endfor" ("}" | "~}")
 * )
 */
TemplateFor
  = "%{" strip_start:"~"? _ 
    "for" _ key:Identifier _ v:("," _ value:Identifier { return value })? _ 
    "in" _ collection:Expression _ 
    strip_end:"~"? "}"
    body:Template
    "%{" strip_endfor_start:"~"? _ "endfor" _ strip_endfor_end:"~"? "}" {
		
    return {
      type: NodeTypes.TemplateFor,
      intro: { key, value: v || null, collection },
      body: body,
      strip: {
        for: { start: !!strip_start, end: !!strip_end },
        endfor: { start: !!strip_endfor_start, end: !!strip_endfor_end }
      }
    }
  }

//
// Function Call Expressions ---------------------------------------------------
//

/**
 * Function Call Expressions
 * FunctionCall = Identifier "(" arguments ")";
 */
FunctionCall
	= name:Identifier _ "(" __ args:_function_args? __ ")" 
	{ return { type: NodeTypes.FunctionCallExpression, name, args: args || [] } }

/**
 * Function arguments
 * arguments = (() || (Expression ("," Expression)* ("," | "...")?)
 */
_function_args
  = first:Expression rest:(__ "," __ expr:Expression { return expr })* __ ","?
    { return first ? [first, ...(rest || [])] : [] }
  / _ { return [] }

//
// Variable Expressions ---------------------------------------------------------
//

VariableExpr
  = name:Identifier { return { type: NodeTypes.VariableExpression, name } }


//
// Postfix operators: Index, GetAttr, and Splat --------------------------------
//

// Index = "[" Expression "]"
Index
  = _ "[" _ expr:Expression _ "]" {
    return {
      type: NodeTypes.IndexOperator,
      key: expr
    }
  }
  / LegacyIndex

// Legacy index operator for HIL compatibility
LegacyIndex
  = "." digits:$[0-9]+ {
    return {
      type: NodeTypes.LegacyIndexOperator,
      key: { type: NodeTypes.NumberLiteral, value: parseInt(digits, 10) }
    }
  }

// GetAttr = "." Identifier
// Identifier cannot be a number (or numeric-only string) such that
// we can distinguish it from a legacy index operator
GetAttr
  = _ "." _ key:Identifier 
	{ return { type: NodeTypes.GetAttributeOperator, key } }

// Splat = attrSplat | fullSplat
// attrSplat = "." "*" GetAttr*
// fullSplat = "[" "*" "]" (GetAttr | Index)*
Splat
  = AttrSplat
  / FullSplat

AttrSplat
  = _ "." _ "*" attributes:GetAttr* {
    return { type: NodeTypes.SplatOperator, kind: SplatKinds.Attribute, attributes }
  }

FullSplat
  = _ "[" _ "*" _ "]" operations:(GetAttr / Index)* 
	{ return { type: NodeTypes.SplatOperator, kind: SplatKinds.Full, operations } }


//
// Helper rules -----------------------------------------------------------------
//

/**
 * Whitespace is defined as a sequence of zero or more space characters
 * (U+0020). Newline sequences (either U+000A or U+000D followed by U+000A)
 * are _not_ considered whitespace but are ignored as such in certain contexts.
 * Horizontal tab characters (U+0009) are also treated as whitespace, but are
 * counted only as one "column" for the purpose of reporting source positions.
 */

_ws "whitespace" = [ \t] / InlineComment
_ "zero or more whitespace" = _ws*
__ "zero or more empty lines" = (_ws* NewLine)*(_ws*)?
__eof "end of file" = !.

_hex = [0-9a-fA-F]
_escape_seq
  = "\\" sequence:(
      "n"  { return "\n" }   // newline
    / "r"  { return "\r" }   // carriage return
    / "t"  { return "\t" }   // tab
    / '"'  { return '"' }    // quote
    / "\\" { return "\\" }   // backslash
    / "u" digits:$(_hex _hex _hex _hex) {
        return String.fromCharCode(parseInt(digits, 16))
      }
    / "U" digits:$(_hex _hex _hex _hex _hex _hex _hex) {
        return String.fromCodePoint(parseInt(digits, 16))
      }
  ) { return sequence }

// Template-specific escape sequences
_template_escape
  = "$$" { return "$" }  // Escaped interpolation
  / "%%" { return "%" }  // Escaped directive

// String literal characters with escape sequences
_char
  = _escape_seq
  / !["\\\n\r] . { return text() }

// Template characters with escape sequences
_template_char
  = _escape_seq
  / _template_escape
  / !["\\\n\r$%] . { return text() }
