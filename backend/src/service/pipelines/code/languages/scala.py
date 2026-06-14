SCALA_QUERIES = {
    "functions": """
        (function_definition
            name: (identifier) @name
            parameters: (parameters) @params
        ) @function_node
    """,
    "classes": """
        [
            (class_definition name: (identifier) @name)
            (object_definition name: (identifier) @name)
            (trait_definition name: (identifier) @name)
        ] @class
    """,
    "imports": """
        (import_declaration) @import
    """,
    "calls": """
        (call_expression) @call_node
        (generic_function
             function: (identifier) @name
        ) @call_node
    """,
    "variables": """
        (val_definition
            pattern: (identifier) @name
        ) @variable
        
        (var_definition
            pattern: (identifier) @name
        ) @variable
    """,
}
