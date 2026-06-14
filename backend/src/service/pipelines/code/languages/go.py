GO_QUERIES = {
    "functions": """
        (function_declaration
            name: (identifier) @name
            parameters: (parameter_list) @params
        ) @function_node
        
        (method_declaration
            receiver: (parameter_list) @receiver
            name: (field_identifier) @name
            parameters: (parameter_list) @params
        ) @function_node
    """,
    "structs": """
        (type_declaration
            (type_spec
                name: (type_identifier) @name
                type: (struct_type) @struct_body
            )
        ) @struct_node
    """,
    "interfaces": """
        (type_declaration
            (type_spec
                name: (type_identifier) @name
                type: (interface_type) @interface_body
            )
        ) @interface_node
    """,
    "imports": """
        (import_declaration
            (import_spec
                path: (interpreted_string_literal) @path
            )
        ) @import
        
        (import_declaration
            (import_spec
                name: (package_identifier) @alias
                path: (interpreted_string_literal) @path
            )
        ) @import_alias
    """,
    "calls": """
        (call_expression
            function: (identifier) @name
        )
        (call_expression
            function: (selector_expression
                field: (field_identifier) @name
            )
        )
    """,
    "variables": """
        (var_declaration
            (var_spec
                name: (identifier) @name
            )
        )
        (short_var_declaration
            left: (expression_list
                (identifier) @name
            )
        )
    """,
}
