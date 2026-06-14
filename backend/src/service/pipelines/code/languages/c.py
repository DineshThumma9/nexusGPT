C_QUERIES = {
    "functions": """
        (function_definition
            declarator: (function_declarator
                declarator: (identifier) @name
            )
        ) @function_node
        
        (function_definition
            declarator: (function_declarator
                declarator: (pointer_declarator
                    declarator: (identifier) @name
                )
            )
        ) @function_node
    """,
    "structs": """
        (struct_specifier
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @struct
    """,
    "typedef_structs": """
        (type_definition
            (struct_specifier)
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @typedef_struct
    """,
    "typedef_enums": """
        (type_definition
            (enum_specifier)
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @typedef_enum
    """,
    "typedef_unions": """
        (type_definition
            (union_specifier)
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @typedef_union
    """,
    "unions": """
        (union_specifier
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @union
    """,
    "enums": """
        (enum_specifier
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @enum
    """,
    "typedefs": """
        (type_definition
            [
                (type_identifier) @name
                (identifier) @name
            ]
        ) @typedef
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
            function: (identifier) @name
        )
    """,
    "variables": """
        (declaration
            declarator: (init_declarator
                declarator: (identifier) @name
            )
        )
        
        (declaration
            declarator: (init_declarator
                declarator: (pointer_declarator
                    declarator: (identifier) @name
                )
            )
        )
        
        (declaration
            declarator: (identifier) @name
        )
        
        (declaration
            declarator: (pointer_declarator
                declarator: (identifier) @name
            )
        )
    """,
    "macros": """
        (preproc_def
            name: (identifier) @name
        ) @macro
    """,
}
