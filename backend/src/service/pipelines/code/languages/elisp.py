ELISP_QUERIES = {
    "functions": """
        [
          (function_definition
            name: (symbol) @name
            parameters: (list) @parameters
            docstring: (string)? @docstring) @function_node
          (macro_definition
            name: (symbol) @name
            parameters: (list) @parameters
            docstring: (string)? @docstring) @function_node
          ((list
            . (symbol) @kind
            . (symbol) @name
            . (list) @parameters) @function_node
            (#eq? @kind "cl-defun"))
        ]
    """,
    "variables": """
        (special_form
          "defvar" @kind
          (symbol) @name) @variable_node
        (special_form
          "defconst" @kind
          (symbol) @name) @variable_node
        ((list
          . (symbol) @kind
          . (symbol) @name) @variable_node
          (#eq? @kind "defcustom"))
        (special_form
          "setq" @kind
          (symbol) @name) @variable_node
    """,
    "features": """
        ((list
          . (symbol) @kind
          . (quote (symbol) @feature)) @feature_node
          (#match? @kind "^(require|provide)$"))
        ((list
          . (symbol) @kind
          . (quote (symbol) @autoloaded_name)
          . (string) @source_file) @autoload_node
          (#eq? @kind "autoload"))
    """,
    "calls": """
        [
          (list
            . (symbol) @name) @call_node
          (quote
            (symbol) @quoted_name) @quote_node
        ]
    """,
}


FUNCTION_FORMS = {"defun", "defsubst", "defmacro", "cl-defun"}
VARIABLE_FORMS = {"defvar", "defconst", "defcustom"}
IMPORT_FORMS = {"require", "provide", "autoload"}
SPECIAL_FORMS = {
    "and",
    "catch",
    "cond",
    "condition-case",
    "declare",
    "if",
    "interactive",
    "lambda",
    "let",
    "let*",
    "dolist",
    "dotimes",
    "or",
    "prog1",
    "prog2",
    "progn",
    "quote",
    "save-current-buffer",
    "save-excursion",
    "save-restriction",
    "setq",
    "throw",
    "unwind-protect",
    "when",
    "while",
    "unless",
}
BINDING_FORMS = {"let", "let*", "dolist", "dotimes"}
CALL_EXCLUDED_FORMS = (
    FUNCTION_FORMS | VARIABLE_FORMS | IMPORT_FORMS | SPECIAL_FORMS | BINDING_FORMS
)
CONTROL_FORMS = {
    "and",
    "catch",
    "cond",
    "condition-case",
    "dolist",
    "dotimes",
    "if",
    "or",
    "unwind-protect",
    "when",
    "while",
    "unless",
}
