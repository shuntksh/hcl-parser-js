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
  = __ items:(
			// Body can be surrounded by empty lines
			__ item:BodyElement __ {
				return item
			})*
			{
				return items
			}

BodyElement
  = Attribute
  / Block
  / OneLineBlock

/**
 * Attribute assigns a value to a name
 */
Attribute
  = _ name:Identifier 
	  _ "="
		_ value:Expression 
		_ terminator:(NewLine / __eof) {
      return {
        type: NodeTypes.Attribute,
        name: name,
        value: value
      }
    }

/**
 * Block creates a child body with type and optional labels
 */
Block
  = _ type:Identifier 
		_ labels:(_ (StringLit / Identifier))* 
    _ "{" 
		_ NewLine
    _ bodies:Bodies?
    _ "}"
		_ terminator:(NewLine / __eof) 
		{
      return {
        type: NodeTypes.Block,
        blockType: type,
				// TODO: Hack. Taking the second element as the label as " " matches too
        labels: labels.map(l => l[1]),
        bodies: bodies
      }
    }

/**
 * OneLineBlock is a simplified block format for single attributes
 */
OneLineBlock
  = _ type:Identifier
		_ labels:(_ (StringLit / Identifier))*
    _ "{"
    _ (name:Identifier _ "=" _ value:Expression)?
    _ "}"
		_ terminator:(NewLine / __eof) {
      return {
        type: NodeTypes.OneLineBlock,
        blockType: type,
				// TODO: Hack. Taking the second element as the label as " " matches too
        labels: labels.map(l => l[1]),
        body: attr
      }
    }

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

/**
 * StringLit represents a quoted string literal with escape sequences.
 * Does not allow raw newlines, only escaped ones (\n).
 */
StringLit
  = '"' chars:_char* '"' { 
      return {type: NodeTypes.StringLiteral, value: chars.join('')}
    }


//
// Expression Sub-languages -----------------------------------------------------
//

Expression
  = term:_expr_term ops:Operators? {
      return ops ? ops : term
    }

_expr_term
  = head:(
				  TemplateExpr
				/ LiteralValue
				/ FunctionCall
				/ CollectionValue
				/ VariableExpr
				/ ForExpr
				/ "(" _ expr:Expression _ ")" { return expr }
				)
	  tail:(Index / GetAttr / Splat)* {
			// Apply postfix operators in sequence
			return tail.reduce((expr, op) => ({
				...op,
				target: expr
		}), head)
	}

//
// Literal Expressions ---------------------------------------------------------
//

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
		{
		return {
			type: NodeTypes.TupleValue,
			elements: elements.flat()
		}
	}

// object = "{" ((objectelem (( "," | Newline) objectelem)* ","?)?) "}";
// Return as a list of key-value pairs (objectelem)
// TODO: we need to check for duplicate keys
_object
  = _ "{" 
    __ !"for"
    elements:(_object_content)?
    __ "}" 
    _ {
      return {
        type: NodeTypes.ObjectValue,
        elements: elements || []
      }
    }

_object_content
  = first:_objectelem
    rest:(__ _objectelem)* {
      return [first, ...rest.map(r => r[1])]
    }

_objectelem
  = __ key:Identifier 
    _ ("=" / ":")
    _ value:Expression 
    (_ "," / NewLine / __) {
      return {
        key: key,
        value: value
      }
    }

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
  = '"' content:QuotedTemplateContent* '"' {
    return {
      type: NodeTypes.QuotedTemplateExpression,
      parts: content.flat()
    }
  }

QuotedTemplateContent
  = TemplateInterpolation
  / TemplateDirective
  / chars:_template_char+ {
      return { type: NodeTypes.TemplateLiteral, value: chars.join('') }
    }


/**
 * Heredoc template
 */
HeredocTemplate
  = _ "<<" indent:("-"/"") _ marker:_beginMarker _ NewLine
    	template:HeredocTemplateContent
    	_endMarker {
				return {
					type: NodeTypes.HeredocTemplateExpression,
					marker: marker,
					stripIndent: indent === "-",
					template: template
				}
			}

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
  = chars:(!("${" / "%{" / _endMarker) .)+ {
		return {
			type: NodeTypes.TemplateLiteral,
			value: chars.map(c => c[1]).join('')
		}
	}

/**
 * TemplateInterpolation = ("${" | "${~") Expression ("}" | "~}");
 * Strip markers (~) remove adjacent whitespace
 */
TemplateInterpolation
  = "${" strip_left:"~"? 
    _ expr:Expression _ 
    strip_right:"~"? "}" {
    return {
      type: NodeTypes.TemplateInterpolation,
      expr: expr,
      strip: {
        left: strip_left !== null,
        right: strip_right !== null
      }
    }
  }

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
      { return {
          template: else_template,
          strip: {
            start: strip_else_start !== null,
            end: strip_else_end !== null
          }
        }
      }
    )?
    "%{" strip_endif_start:"~"? _ "endif" _ strip_endif_end:"~"? "}" {
    return {
      type: NodeTypes.TemplateIf,
      condition: condition,
      then: then_template,
      else: else_part?.template,
      strip: {
        if: {
          start: strip_start !== null,
          end: strip_end !== null
        },
        else: else_part?.strip,
        endif: {
          start: strip_endif_start !== null,
          end: strip_endif_end !== null
        }
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
    "for" _ key:Identifier _ value:("," _ Identifier)? _ 
    "in" _ collection:Expression _ 
    strip_end:"~"? "}"
    body:Template
    "%{" strip_endfor_start:"~"? _ "endfor" _ strip_endfor_end:"~"? "}" {
    return {
      type: NodeTypes.TemplateFor,
      intro: {
        key: key,
        value: value ? value[2] : null,
        collection: collection
      },
      body: body,
      strip: {
        for: {
          start: strip_start !== null,
          end: strip_end !== null
        },
        endfor: {
          start: strip_endfor_start !== null,
          end: strip_endfor_end !== null
        }
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
	= name:Identifier _ "(" __ args:_function_args? __ ")" {
    return {
      type: NodeTypes.FunctionCallExpression,
      name: name,
      args: args // List of Expressions
    }
  }

/**
 * Function arguments
 * arguments = (() || (Expression ("," Expression)* ("," | "...")?)
 */
_function_args
  = _
	/ _ args:(Expression (_ "," __ Expression)* _ ","?)? {
    return args
  }


//
// Variable Expressions ---------------------------------------------------------
//

VariableExpr
  = name:Identifier {
    return {
      type: NodeTypes.VariableExpression,
      name: name
    }
  }


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
  = "[" _ intro:_for_intro _ expr:Expression _ cond:_for_cond? _ "]" {
    return {
      type: NodeTypes.ForExpression,
      kind: ForKinds.Tuple,
      intro: intro,
      expr: expr,
      condition: cond
    }
  }

ForObjectExpr
  = "{" _ intro:_for_intro _ key:Expression _ "=>" _ value:Expression 
    ellipsis:(_ "...")? _ cond:_for_cond? _ "}" {
    return {
      type: NodeTypes.ForExpression,
      kind: ForKinds.Object,
      intro: intro,
      key: key,
      value: value,
      grouping: ellipsis !== null,
      condition: cond
    }
  }

_for_intro
  = "for" _ key:Identifier _ value:("," _ Identifier)? _ 
    "in" _ collection:Expression _ ":" {
    return {
      iterator: key,
      value: value ? value[2] : null,
      collection: collection
    }
  }

_for_cond
  = "if" _ expr:Expression {
    return expr
  }

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
  = _ "." _ name:Identifier {
    return {
      type: NodeTypes.GetAttributeOperator,
      name: name
    }
  }

// Splat = attrSplat | fullSplat
// attrSplat = "." "*" GetAttr*
// fullSplat = "[" "*" "]" (GetAttr | Index)*
Splat
  = AttrSplat
  / FullSplat

AttrSplat
  = _ "." _ "*" attrs:GetAttr* {
    return {
      type: NodeTypes.SplatOperator,
      kind: SplatKinds.Attribute,
      attrs: attrs
    }
  }

FullSplat
  = _ "[" _ "*" _ "]" ops:(GetAttr / Index)* {
    return {
      type: NodeTypes.SplatOperator,
      kind: SplatKinds.Full, 
      ops: ops
    }
	}


//
// Conditional Operator ---------------------------------------------------------
//

// Simply wrap the conditional operator to avoid confusion as it has other 
// operations with lower precedence following it.
Operators = ConditionalOp

// Conditional = Expression "?" Expression ":" Expression
ConditionalOp
  = _ predicate:Expression _ "?"
    _ trueExpr:Expression _ ":" 
    _ falseExpr:Expression
		_ {
    return {
      type: NodeTypes.ConditionalOperator,
      predicate: predicate,
      trueExpr: trueExpr,
      falseExpr: falseExpr
    }
  }
  / Operation

//
// Operations -------------------------------------------------------------------
//

// Operation = unaryOp | Binary
Operation
  = UnaryOp
  / Binary

// unaryOp = ("-" | "!") _expr_term
UnaryOp
  = _ op:("-" / "!") _ term:_expr_term {
    return {
      type: NodeTypes.UnaryOperator,
      operator: op,
      term: term
    }
  }

// Binary operations with precedence levels (highest to lowest)
// Note that the precedence levels are not explicitly defined in the grammar
// but are implied by the order of the rules.
// For example, the MultiplicativeExpr rule binds tighter than the AdditiveExpr rule.
// This is because the MultiplicativeExpr rule is defined before the AdditiveExpr rule.
Binary
  = MultiplicativeExpr  // Level 6
	// Note: Intentionally commenting out for documentation purpose
	// See each level for the precedence rules.
	// / AdditiveExpr       // Level 5
	// / ComparisonExpr     // Level 4
	// / EqualityExpr       // Level 3
	// / LogicalAndExpr     // Level 2
	// / LogicalOrExpr      // Level 1
	// / _expr_term  <--- lowest precedence
	// End of intentionally commented out code

// Level 6: * / %
MultiplicativeExpr
  = left:_expr_term _ op:("*" / "/" / "%") _ right:_expr_term {
    return {
      type: NodeTypes.BinaryOperator,
      operator: op,
      left: left,
      right: right
    }
  }
  / AdditiveExpr

// Level 5: + -
AdditiveExpr
  = left:_expr_term _ op:("+" / "-") _ right:_expr_term {
    return {
      type: NodeTypes.BinaryOperator,
      operator: op,
      left: left,
      right: right
    }
  }
  / ComparisonExpr

// Level 4: > >= < <=
ComparisonExpr
  = left:_expr_term _ op:(">=" / "<=" / ">" / "<") _ right:_expr_term {
    return {
      type: NodeTypes.BinaryOperator,
      operator: op,
      left: left,
      right: right
    }
  }
  / EqualityExpr

// Level 3: == !=
EqualityExpr
  = left:_expr_term _ op:("==" / "!=") _ right:_expr_term {
    return {
      type: NodeTypes.BinaryOperator,
      operator: op,
      left: left,
      right: right
    }
  }
  / LogicalAndExpr

// Level 2: &&
LogicalAndExpr
  = left:_expr_term _ "&&" _ right:_expr_term {
    return {
      type: NodeTypes.BinaryOperator,
      operator: "&&",
      left: left,
      right: right
    }
  }
  / LogicalOrExpr

// Level 1: ||
LogicalOrExpr
  = left:_expr_term _ "||" _ right:_expr_term {
    return {
      type: NodeTypes.BinaryOperator,
      operator: "||",
      left: left,
      right: right
    }
  }
  / _expr_term

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
