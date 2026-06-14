import logging
from pathlib import Path
from typing import Dict

_log = logging.getLogger(__name__)


CPP_QUERIES = {
    "functions": """
        (function_definition
            declarator: (function_declarator
                declarator: [
                    (identifier) @name
                    (field_identifier) @name
                    (qualified_identifier) @qualified_name
                ]
            )
        ) @function_node
    """,
    "classes": """
        (class_specifier
            name: (type_identifier) @name
        ) @class
    """,
    "imports": """
        (preproc_include
            path: [
                (string_literal) @path
                (system_lib_string) @path
            ]
        ) @import
    """,
    "calls": """
        (call_expression
            function: [
                (identifier) @function_name
                (field_expression
                    field: (field_identifier) @method_name
                )
                (qualified_identifier) @scoped_name
            ]
        arguments: (argument_list) @args
    )
    """,
    "enums": """
        (enum_specifier
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @enum

        (type_definition
            (enum_specifier)
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @typedef_enum
    """,
    "structs": """
        (struct_specifier
            [
                (type_identifier) @name
                (identifier) @name
            ]
            body: (field_declaration_list)? @body
        ) @struct

        (type_definition
            (struct_specifier)
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @typedef_struct
    """,
    "unions": """
        (union_specifier
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @union

        (type_definition
            (union_specifier)
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @typedef_union
    """,
    "macros": """
        (preproc_def
            name: (identifier) @name
        ) @macro
    """,
    "variables": """
    (declaration
        declarator: (init_declarator
                        declarator: (identifier) @name))

    (declaration
        declarator: (init_declarator
                        declarator: (pointer_declarator
                            declarator: (identifier) @name)))

    (field_declaration
        declarator: [
             (field_identifier) @name
             (pointer_declarator declarator: (field_identifier) @name)
             (array_declarator declarator: (field_identifier) @name)
             (reference_declarator (field_identifier) @name)
        ]
    )
    """,
    "lambda_assignments": """
    ; Match a lambda assigned to a variable
    (declaration
        declarator: (init_declarator
            declarator: (identifier) @name
            value: (lambda_expression) @lambda_node))
    """,
}
