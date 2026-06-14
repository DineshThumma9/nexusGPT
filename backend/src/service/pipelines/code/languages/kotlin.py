KOTLIN_QUERIES = {
    "functions": """
        (function_declaration
            (simple_identifier) @name
            (function_value_parameters) @params
        ) @function_node
    """,
    "classes": """
        [
            (class_declaration (type_identifier) @name)
            (object_declaration (type_identifier) @name)
            (companion_object (type_identifier)? @name)
        ] @class
    """,
    "imports": """
        (import_header) @import
    """,
    "calls": """
        (call_expression) @call_node
        (constructor_invocation) @call_node
        (constructor_delegation_call) @call_node
        (callable_reference) @call_node
    """,
    "variables": """
        (property_declaration
            (variable_declaration
                (simple_identifier) @name
            )
        ) @variable
        (class_parameter
            (binding_pattern_kind)
            (simple_identifier) @name
        ) @variable
        (parameter
            (simple_identifier) @name
        ) @variable
    """,
}
