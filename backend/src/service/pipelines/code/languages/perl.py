# src/service/pipelines/code/languages/perl.py

PERL_QUERIES = {
    "functions": """
        (subroutine_declaration_statement
            name: (bareword) @name
        ) @function_node
    """,
    "classes": """
        (package_statement
            name: (package) @name
        ) @class
    """,
    "imports": """
        (use_statement
            (package) @import
        ) @import_node
    """,
    "calls": """
        (method_call_expression
            method: (method) @name
        ) @call
        (ambiguous_function_call_expression
            function: (function) @name
        ) @call
        (function_call_expression
            function: (function) @name
        ) @call
    """,
    "variables": """
        (variable_declaration
            [
                (scalar (varname) @name)
                (array (varname) @name)
                (hash (varname) @name)
            ]
        ) @variable
    """,
}
