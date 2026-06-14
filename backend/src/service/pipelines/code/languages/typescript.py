TS_QUERIES = {
    "functions": """
        (function_declaration
            name: (identifier) @name
            parameters: (formal_parameters) @params
        ) @function_node

        (variable_declarator
            name: (identifier) @name
            value: (function_expression
                parameters: (formal_parameters) @params
            ) @function_node
        )

        (variable_declarator
            name: (identifier) @name
            value: (arrow_function
                parameters: (formal_parameters) @params
            ) @function_node
        )

        (variable_declarator
            name: (identifier) @name
            value: (arrow_function
                parameter: (identifier) @single_param
            ) @function_node
        )

        (method_definition
            name: (property_identifier) @name
            parameters: (formal_parameters) @params
        ) @function_node

        (assignment_expression
            left: (member_expression
                property: (property_identifier) @name
            )
            right: (function_expression
                parameters: (formal_parameters) @params
            ) @function_node
        )

        (assignment_expression
            left: (member_expression
                property: (property_identifier) @name
            )
            right: (arrow_function
                parameters: (formal_parameters) @params
            ) @function_node
        )
    """,
    "classes": """
        (class_declaration) @class
        (abstract_class_declaration) @class
        (class) @class
    """,
    "interfaces": """
        (interface_declaration
            name: (type_identifier) @name
        ) @interface_node
    """,
    "type_aliases": """
        (type_alias_declaration
            name: (type_identifier) @name
        ) @type_alias_node
    """,
    "imports": """
        (import_statement) @import
        (call_expression
            function: (identifier) @require_call (#eq? @require_call "require")
        ) @import
    """,
    "calls": """
        (call_expression function: (identifier) @name)
        (call_expression function: (member_expression property: (property_identifier) @name))
        (new_expression constructor: (identifier) @name)
        (new_expression constructor: (member_expression property: (property_identifier) @name))
    """,
    "variables": """
        (variable_declarator name: (identifier) @name)
    """,
    "docstrings": """
        (comment) @docstring_comment
    """,
}
