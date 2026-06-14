ELIXIR_QUERIES = {
    "modules": """
        (call
            target: (identifier) @keyword
            (arguments (alias) @name)
            (do_block)
        ) @module_node
    """,
    "functions": """
        (call
            target: (identifier) @keyword
            (arguments
                (call
                    target: (identifier) @name
                )
            )
        ) @function_node
    """,
    "imports": """
        (call
            target: (identifier) @keyword
            (arguments (alias) @path)
        ) @import_node
    """,
    "calls": """
        (call
            target: (dot
                left: (_) @receiver
                right: (identifier) @name
            )
            (arguments) @args
        ) @call_node
    """,
    "simple_calls": """
        (call
            target: (identifier) @name
            (arguments) @args
        ) @call_node
    """,
    "module_attributes": """
        (unary_operator
            operator: "@"
            operand: (call
                target: (identifier) @attr_name
                (arguments (_) @attr_value)
            )
        ) @attribute
    """,
    "comments": """
        (comment) @comment
    """,
}

# Keywords that define modules/namespaces
MODULE_KEYWORDS = {"defmodule", "defprotocol", "defimpl"}

# Keywords that define functions
FUNCTION_KEYWORDS = {
    "def",
    "defp",
    "defmacro",
    "defmacrop",
    "defguard",
    "defguardp",
    "defdelegate",
}

# Keywords that represent imports/dependencies
IMPORT_KEYWORDS = {"use", "import", "alias", "require"}

# Keywords to exclude from general call detection
ELIXIR_KEYWORDS = (
    MODULE_KEYWORDS
    | FUNCTION_KEYWORDS
    | IMPORT_KEYWORDS
    | {
        "quote",
        "unquote",
        "case",
        "cond",
        "if",
        "unless",
        "for",
        "with",
        "try",
        "receive",
        "raise",
        "reraise",
        "throw",
        "super",
    }
)
