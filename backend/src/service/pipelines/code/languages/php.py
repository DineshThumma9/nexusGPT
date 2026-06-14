PHP_QUERIES = {
    "functions": """
        (function_definition
            name: (name) @name
            parameters: (formal_parameters) @params
        ) @function_node

        (method_declaration
            name: (name) @name
            parameters: (formal_parameters) @params
        ) @function_node
    """,
    "classes": """
        (class_declaration
            name: (name) @name
        ) @class
        
        (interface_declaration
            name: (name) @name
        ) @interface
        
        (trait_declaration
            name: (name) @name
        ) @trait
    """,
    "imports": """
        (use_declaration) @import
    """,
    "calls": """
        (function_call_expression
            function: [
                (qualified_name) @name
                (name) @name
            ]
        ) @call_node
        
        (member_call_expression
            name: (name) @name
        ) @call_node
        
        (scoped_call_expression
            name: (name) @name
        ) @call_node
        
        (object_creation_expression) @call_node
    """,
    "variables": """
        (variable_name) @variable
    """,
}
